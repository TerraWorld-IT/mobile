package app.terraworld.mobile;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 거리 기록 백그라운드 위치 수집 — while-in-use foreground service (location type).
 *
 * 원격-URL WebView 는 백그라운드에서 JS 가 정지해 웹 geolocation watch 가 끊긴다
 * (2026-07-21 사용자 리포트: 백그라운드 구간 거리 유실). 본 서비스는 화면이 보이는 상태에서
 * 시작(FGS while-in-use — ACCESS_BACKGROUND_LOCATION 불요)해 백그라운드 동안 위치 fix 를
 * in-memory bounded queue 에 쌓고, 포그라운드 복귀 시 DistanceTrackerPlugin.drain 이
 * 웹 레이어로 배출한다.
 *
 * ⚠️ Play Console: FGS location type 은 선언서 제출 대상. 실기기(화면잠금/OEM 절전) QA 필요.
 */
public class DistanceTrackingService extends Service {

    public static class Fix {
        public final long seq;
        public final long time;
        public final double lat;
        public final double lng;
        public final float accuracy;

        Fix(long seq, long time, double lat, double lng, float accuracy) {
            this.seq = seq;
            this.time = time;
            this.lat = lat;
            this.lng = lng;
            this.accuracy = accuracy;
        }
    }

    private static final String CHANNEL_ID = "distance_tracking";
    private static final int NOTIFICATION_ID = 7201;
    // 3초 간격 기준 약 16시간 분량 — drain 없이 초과 시 앞쪽 fix 가 삭제된다(하한 집계로 저하).
    // fix 1건 ~50B 라 메모리 부담 무시 가능 (Codex R1 F7 — 한계는 주석·FE 50m 필터로 완화).
    private static final int MAX_QUEUE = 20000;

    // 플러그인과 같은 프로세스 — static 큐로 공유. 세션당 하나만 유효.
    private static final ConcurrentLinkedDeque<Fix> QUEUE = new ConcurrentLinkedDeque<>();
    private static final AtomicLong SEQ = new AtomicLong(0);
    private static volatile String activeSessionId = null;

    private LocationManager locationManager;
    private LocationListener listener;

    public static String getActiveSessionId() {
        return activeSessionId;
    }

    /** afterSeq 초과분 스냅샷 반환 (제거하지 않음 — 중복은 seq 로 클라가 dedup). */
    public static List<Fix> snapshotAfter(long afterSeq) {
        List<Fix> out = new ArrayList<>();
        for (Fix f : QUEUE) {
            if (f.seq > afterSeq) out.add(f);
        }
        return out;
    }

    public static long lastSeq() {
        Fix last = QUEUE.peekLast();
        return last != null ? last.seq : SEQ.get();
    }

    public static void resetForSession(String sessionId) {
        activeSessionId = sessionId;
        QUEUE.clear();
    }

    public static void clearSession() {
        activeSessionId = null;
        QUEUE.clear();
    }

    @Override
    public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    }

    /** stop 명령 액션 — 세션 검사를 서비스(직렬화된 onStartCommand) 안에서 수행해
     *  plugin 측 check-then-stop TOCTOU 를 제거한다 (Codex R3 #1). */
    public static final String ACTION_STOP = "app.terraworld.mobile.distance.STOP";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String sessionId = intent != null ? intent.getStringExtra("sessionId") : null;
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            // 세션 일치 시에만 종료 — stale 세션의 늦은 stop 이 새 세션을 죽이지 않는다.
            // stopSelf(startId): 이 명령 이후 이미 큐잉된 신규 start 가 있으면 종료가
            // 무효화되는 Android 계약 사용 (Codex R4 — stopSelf() 무인자는 그 start 까지 죽임).
            if (sessionId != null && sessionId.equals(activeSessionId)) {
                stopLocationUpdates();
                clearSession();
                stopSelf(startId);
            }
            else if (activeSessionId == null) {
                // stop 인텐트가 유휴 상태에서 서비스를 새로 띄운 경우 — 즉시 정리.
                stopSelf(startId);
            }
            return START_NOT_STICKY;
        }
        if (sessionId == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        resetForSession(sessionId);
        startInForeground();
        // 재시작(새 세션) 시 기존 listener 를 먼저 제거 — 미제거 시 listener 가 누적 등록되어
        // 같은 fix 가 중복 수집된다 (Codex R1 F1).
        stopLocationUpdates();
        startLocationUpdates();
        // 프로세스 kill 시 재시작하지 않는다 — 세션 상태(웹 레이어)와 어긋난 유령 수집 방지.
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // 최근 앱 목록에서 제거(swipe-away) 시 FGS 가 계속 위치를 수집하는 유령 상태 방지
        // (Codex R1 F1 — stopWithTask 기본값 false).
        clearSession();
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    private void startInForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "거리 기록", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("이동 거리 기록 중 위치를 수집합니다");
            nm.createNotificationChannel(channel);
        }
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("거리 기록 중")
            .setContentText("TerraWorld 가 이동 거리를 기록하고 있어요")
            .setSmallIcon(getApplicationInfo().icon)
            .setOngoing(true)
            .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void startLocationUpdates() {
        boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
        if (!fine || locationManager == null) {
            stopSelf();
            return;
        }
        listener = new LocationListener() {
            @Override
            public void onLocationChanged(@NonNull Location location) {
                if (QUEUE.size() >= MAX_QUEUE) QUEUE.pollFirst();
                QUEUE.addLast(new Fix(
                    SEQ.incrementAndGet(),
                    location.getTime(),
                    location.getLatitude(),
                    location.getLongitude(),
                    location.getAccuracy()
                ));
            }
        };
        try {
            // GPS 우선(도보/러닝 정확도), 3초/5m — 배터리와 해상도 균형. 신규 의존성 없이
            // 플랫폼 LocationManager 사용 (FusedLocationProvider 미도입).
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER, 3000L, 5f, listener);
        } catch (SecurityException e) {
            stopSelf();
        }
    }

    private void stopLocationUpdates() {
        if (locationManager != null && listener != null) {
            locationManager.removeUpdates(listener);
        }
        listener = null;
    }

    @Override
    public void onDestroy() {
        stopLocationUpdates();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
