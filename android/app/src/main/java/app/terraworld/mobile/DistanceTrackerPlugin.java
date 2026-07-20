package app.terraworld.mobile;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
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
 *   start({ sessionId })                          — 화면이 보일 때 호출(FGS while-in-use 시작)
 *   drain({ sessionId, afterSeq }) → {fixes,lastSeq} — 포그라운드 복귀 시 신규 fix 회수
 *   stop({ sessionId, afterSeq })  → {fixes,lastSeq} — 종료 + 잔여 회수
 *
 * 세션 불일치(웹 세션 ≠ 네이티브 활성 세션) 시 빈 결과 — 웹은 직선거리 하한 보정으로 폴백.
 * ⚠️ 실기기 QA 전까지 웹 쪽은 plugin 부재/실패 시 항상 폴백 경로를 유지해야 한다.
 */
@CapacitorPlugin(name = "DistanceTracker")
public class DistanceTrackerPlugin extends Plugin {

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
        // 화면이 보이는 상태에서 호출되는 전제(while-in-use FGS) — 웹 startDistance 버튼 경로.
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
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
            for (DistanceTrackingService.Fix f : list) {
                JSObject o = new JSObject();
                o.put("seq", f.seq);
                o.put("time", f.time);
                o.put("lat", f.lat);
                o.put("lng", f.lng);
                o.put("accuracy", f.accuracy);
                fixes.put(o);
            }
            ret.put("lastSeq", DistanceTrackingService.lastSeq());
        } else {
            // 세션 불일치 — 유령 데이터 배출 금지 (웹이 하한 보정으로 폴백).
            ret.put("lastSeq", afterSeq);
        }
        ret.put("fixes", fixes);
        return ret;
    }
}
