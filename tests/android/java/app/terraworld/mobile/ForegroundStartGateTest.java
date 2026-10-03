package app.terraworld.mobile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;

/**
 * ForegroundStartGate — 플러그인 start 가 서비스의 실제 시작 결과로만 resolve/reject 되는지 검증.
 * 실패 경로(포그라운드 진입 실패·시간 초과·대체)에서 resolve 가 나가지 않는 것이 핵심이다.
 */
public class ForegroundStartGateTest {

    /** 콜백 호출 기록 — "started" 또는 실패 코드. */
    private static final class Recorder implements ForegroundStartGate.Callback {
        final List<String> events = new ArrayList<>();
        Exception lastCause;

        @Override
        public void onStarted() {
            events.add("started");
        }

        @Override
        public void onFailed(String code, Exception cause) {
            events.add(code);
            lastCause = cause;
        }
    }

    @Test
    public void startedReportResolvesOnce() {
        ForegroundStartGate gate = new ForegroundStartGate();
        Recorder call = new Recorder();
        long token = gate.register("s1", call);

        assertTrue(gate.reportStarted("s1"));
        // 이후 시간 초과·중복 보고는 무시 — 한 호출에 결과는 하나.
        assertFalse(gate.timeout(token));
        assertFalse(gate.reportFailed("s1", "foreground_service_start_failed", null));
        assertEquals(Arrays.asList("started"), call.events);
    }

    @Test
    public void foregroundFailureRejectsWithCause() {
        ForegroundStartGate gate = new ForegroundStartGate();
        Recorder call = new Recorder();
        long token = gate.register("s1", call);
        SecurityException cause = new SecurityException("location FGS type not permitted");

        assertTrue(gate.reportFailed("s1", "foreground_service_start_failed", cause));
        assertFalse(gate.reportStarted("s1"));
        assertFalse(gate.timeout(token));
        assertEquals(Arrays.asList("foreground_service_start_failed"), call.events);
        assertSame(cause, call.lastCause);
    }

    @Test
    public void timeoutRejectsAndLateStartIsRefusedSoServiceCleansUp() {
        ForegroundStartGate gate = new ForegroundStartGate();
        Recorder call = new Recorder();
        long token = gate.register("s1", call);

        assertTrue(gate.timeout(token));
        // 늦게 진입한 서비스는 false 를 받아 스스로 정리해야 한다(웹은 이미 폴백).
        assertFalse(gate.reportStarted("s1"));
        assertEquals(Arrays.asList(ForegroundStartGate.CODE_TIMEOUT), call.events);
        assertNull(call.lastCause);
    }

    @Test
    public void reportForOtherSessionIsIgnored() {
        ForegroundStartGate gate = new ForegroundStartGate();
        Recorder call = new Recorder();
        gate.register("s2", call);

        assertFalse(gate.reportStarted("s1"));
        assertFalse(gate.reportStarted(null));
        assertTrue(call.events.isEmpty());
        assertTrue(gate.reportStarted("s2"));
        assertEquals(Arrays.asList("started"), call.events);
    }

    @Test
    public void newRegistrationSupersedesPendingCallAndOldTimeoutIsStale() {
        ForegroundStartGate gate = new ForegroundStartGate();
        Recorder first = new Recorder();
        Recorder second = new Recorder();
        long firstToken = gate.register("s1", first);
        gate.register("s2", second);

        assertEquals(Arrays.asList(ForegroundStartGate.CODE_SUPERSEDED), first.events);
        // 이전 등록의 시간 초과·보고가 새 호출을 건드리지 않는다.
        assertFalse(gate.timeout(firstToken));
        assertFalse(gate.reportStarted("s1"));
        assertTrue(second.events.isEmpty());
        assertTrue(gate.reportFailed("s2", "location_updates_failed", null));
        assertEquals(Arrays.asList("location_updates_failed"), second.events);
    }

    @Test
    public void unregisteredReportsAreRefused() {
        ForegroundStartGate gate = new ForegroundStartGate();
        assertFalse(gate.reportStarted("s1"));
        assertFalse(gate.reportFailed("s1", "foreground_service_start_failed", null));
        assertFalse(gate.timeout(1L));
    }
}
