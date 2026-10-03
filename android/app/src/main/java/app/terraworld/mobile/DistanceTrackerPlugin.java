package app.terraworld.mobile;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

/**
 * 거리 기록 네이티브 브리지 — 백그라운드 위치 fix 를 웹 레이어로 배출(drain)한다.
 *
 * 계약 (frontend/app/lib/nativeDistanceTracker.ts 와 동기):
 *   start({ sessionId })                          — 화면이 보일 때 호출(FGS while-in-use 시작).
 *                                                   서비스가 포그라운드 진입·위치 수집 등록에 성공해야
 *                                                   resolve, 실패·시간 초과는 reject
 *   drain({ sessionId, afterSeq }) → {fixes,lastSeq} — 포그라운드 복귀 시 신규 fix 회수
 *   stop({ sessionId, afterSeq })  → {fixes,lastSeq} — 종료 + 잔여 회수
 *
 * 세션 불일치(웹 세션 ≠ 네이티브 활성 세션) 시 빈 결과 — 웹은 직선거리 하한 보정으로 폴백.
 * ⚠️ 실기기 QA 전까지 웹 쪽은 plugin 부재/실패 시 항상 폴백 경로를 유지해야 한다.
 */
@CapacitorPlugin(name = "DistanceTracker")
public class DistanceTrackerPlugin extends Plugin {

    // onStartCommand 는 메인 스레드에서 보통 수 ms 안에 끝난다. 시스템의 startForeground 기한(약 10초)
    // 보다 짧게 잡아, 메인 스레드가 오래 막힌 경우에도 웹이 기다리지 않고 폴백하게 한다.
    private static final long START_TIMEOUT_MS = 5000L;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        String sessionId = call.getString("sessionId");
        if (sessionId == null || sessionId.isEmpty()) {
            call.reject("sessionId is required");
            return;
        }
        // 선행 조건 검증 (Codex R1 F2): coarse-only 권한/GPS 꺼짐이면 서비스가 조용히
        // stopSelf 해 "0m 로 영원히 tracking" 무증상 상태가 된다 — 시작 전 명시 reject 로
        // 웹 레이어가 웹 watch 폴백(오류 UI 포함)을 타게 한다.
        boolean fine = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
        if (!fine) {
            call.reject("precise_permission_required");
            return;
        }
        LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (lm == null || !lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            call.reject("gps_disabled");
            return;
        }
        Intent intent = new Intent(getContext(), DistanceTrackingService.class);
        intent.putExtra("sessionId", sessionId);
        // resolve/reject 는 서비스가 실제로 포그라운드에 진입(위치 수집 등록 포함)한 결과로 한다 —
        // 요청 직후 resolve 하면 onStartCommand 의 startForeground 가 나중에 실패해도 웹은 성공으로
        // 알고 웹 watch 폴백을 쓰지 않는다. 서비스 보고보다 먼저 등록해야 보고를 놓치지 않는다.
        long token = DistanceTrackingService.START_GATE.register(sessionId, new ForegroundStartGate.Callback() {
            @Override
            public void onStarted() {
                call.resolve();
            }

            @Override
            public void onFailed(String code, Exception cause) {
                call.reject(code, cause);
            }
        });
        // 화면이 보이는 상태에서 호출되는 전제(while-in-use FGS) — 웹 startDistance 버튼 경로.
        try {
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (IllegalStateException | SecurityException e) {
            // Android 12+ 백그라운드 FGS 시작 제한(ForegroundServiceStartNotAllowedException 은
            // IllegalStateException 하위)·권한 변경 — 앱이 죽지 않게 reject 해 웹 watch 폴백을 타게 한다.
            DistanceTrackingService.START_GATE.reportFailed(sessionId, "foreground_service_start_failed", e);
            return;
        }
        // 서비스 보고가 오지 않으면 reject — 늦게 진입한 서비스는 받을 호출이 없어 스스로 정리한다.
        new Handler(Looper.getMainLooper()).postDelayed(
            () -> DistanceTrackingService.START_GATE.timeout(token), START_TIMEOUT_MS);
    }

    @PluginMethod
    public void drain(PluginCall call) {
        call.resolve(drainInternal(call));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        JSObject ret = drainInternal(call);
        // 종료는 서비스의 직렬화된 onStartCommand(ACTION_STOP)에 위임 — plugin 측
        // check-then-stop 은 새 세션 start 와의 TOCTOU 로 새 세션을 죽일 수 있다 (Codex R3 #1).
        // 세션 불일치면 서비스가 무시한다.
        String sessionId = call.getString("sessionId", "");
        try {
            Intent stopIntent = new Intent(getContext(), DistanceTrackingService.class);
            stopIntent.setAction(DistanceTrackingService.ACTION_STOP);
            stopIntent.putExtra("sessionId", sessionId);
            getContext().startService(stopIntent);
        } catch (Exception e) {
            // 백그라운드 제약 등으로 startService 불가 — 세션 일치 시에만 직접 종료(희귀 경로).
            String active = DistanceTrackingService.getActiveSessionId();
            if (active != null && active.equals(sessionId)) {
                getContext().stopService(new Intent(getContext(), DistanceTrackingService.class));
                DistanceTrackingService.clearSession();
            }
        }
        call.resolve(ret);
    }

    private JSObject drainInternal(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        long afterSeq = call.getLong("afterSeq") != null ? call.getLong("afterSeq") : 0L;

        JSObject ret = new JSObject();
        JSArray fixes = new JSArray();
        String active = DistanceTrackingService.getActiveSessionId();
        if (active != null && active.equals(sessionId)) {
            List<DistanceTrackingService.Fix> list = DistanceTrackingService.snapshotAfter(afterSeq);
            // 커서는 실제로 반환한 fix 의 마지막 seq — 스냅샷 이후 큐에 추가된 fix 를 따로 읽은
            // 큐 끝 seq 로 건너뛰면 다음 drain 에서 그 fix 가 유실된다. 빈 결과면 afterSeq 유지.
            long cursor = afterSeq;
            for (DistanceTrackingService.Fix f : list) {
                if (f.seq > cursor) cursor = f.seq;
                JSObject o = new JSObject();
                o.put("seq", f.seq);
                o.put("time", f.time);
                o.put("lat", f.lat);
                o.put("lng", f.lng);
                o.put("accuracy", f.accuracy);
                fixes.put(o);
            }
            ret.put("lastSeq", cursor);
        } else {
            // 세션 불일치 — 유령 데이터 배출 금지 (웹이 하한 보정으로 폴백).
            ret.put("lastSeq", afterSeq);
        }
        ret.put("fixes", fixes);
        return ret;
    }
}
