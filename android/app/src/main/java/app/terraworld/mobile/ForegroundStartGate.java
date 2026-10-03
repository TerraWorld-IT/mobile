package app.terraworld.mobile;

/**
 * 거리 기록 서비스 시작 결과를 플러그인 start 호출로 한 번만 전달하는 관문.
 *
 * startForegroundService 는 서비스를 띄우기만 하고 실제 포그라운드 진입(startForeground)은
 * 메인 스레드의 onStartCommand 에서 나중에 일어난다. 요청 직후 resolve 하면 그 뒤 권한·백그라운드
 * 제한으로 실패해도 웹은 성공으로 알고 웹 위치 폴백을 쓰지 않는다 — 플러그인은 여기에 대기 호출을
 * 등록하고, 서비스의 성공/실패 보고나 시간 초과 중 먼저 온 것 하나만 콜백으로 전달한다.
 *
 * 안드로이드 의존성이 없는 순수 Java — JVM 단위 테스트로 검증한다 (tests/android).
 * 세션은 동시에 하나뿐이라 대기 호출도 하나만 둔다.
 */
final class ForegroundStartGate {

    interface Callback {
        void onStarted();

        void onFailed(String code, Exception cause);
    }

    static final String CODE_SUPERSEDED = "foreground_service_start_superseded";
    static final String CODE_TIMEOUT = "foreground_service_start_timeout";

    private String pendingSessionId;
    private Callback pendingCallback;
    private long pendingToken;
    private long nextToken;

    /**
     * 대기 호출을 등록하고 시간 초과 처리에 쓸 토큰을 돌려준다. 이전 대기 호출이 남아 있으면
     * superseded 로 실패시킨다(한 번에 한 세션).
     */
    long register(String sessionId, Callback callback) {
        Callback superseded;
        long token;
        synchronized (this) {
            superseded = pendingCallback;
            pendingSessionId = sessionId;
            pendingCallback = callback;
            token = ++nextToken;
            pendingToken = token;
        }
        if (superseded != null) superseded.onFailed(CODE_SUPERSEDED, null);
        return token;
    }

    /** 세션의 포그라운드 진입 성공 보고. 받을 대기 호출이 없으면(시간 초과·대체됨) false — 호출부가 정리한다. */
    boolean reportStarted(String sessionId) {
        Callback cb = take(sessionId);
        if (cb == null) return false;
        cb.onStarted();
        return true;
    }

    /** 세션의 시작 실패 보고. 받을 대기 호출이 없으면 false. */
    boolean reportFailed(String sessionId, String code, Exception cause) {
        Callback cb = take(sessionId);
        if (cb == null) return false;
        cb.onFailed(code, cause);
        return true;
    }

    /** 등록 시 받은 토큰의 대기 호출이 아직 남아 있으면 시간 초과로 실패시킨다. 전달했으면 true. */
    boolean timeout(long token) {
        Callback cb;
        synchronized (this) {
            if (pendingCallback == null || pendingToken != token) return false;
            cb = pendingCallback;
            clear();
        }
        cb.onFailed(CODE_TIMEOUT, null);
        return true;
    }

    /** 콜백은 잠금 밖에서 호출한다 — 콜백 안에서 관문을 다시 불러도 교착되지 않는다. */
    private synchronized Callback take(String sessionId) {
        if (pendingCallback == null || sessionId == null || !sessionId.equals(pendingSessionId)) return null;
        Callback cb = pendingCallback;
        clear();
        return cb;
    }

    private void clear() {
        pendingSessionId = null;
        pendingCallback = null;
        pendingToken = 0;
    }
}
