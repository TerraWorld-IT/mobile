package app.terraworld.mobile;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 앱-로컬 플러그인은 Capacitor bridge 초기화(super.onCreate) 전에 등록해야 한다.
        registerPlugin(InstagramStoriesPlugin.class);
        registerPlugin(DistanceTrackerPlugin.class);
        super.onCreate(savedInstanceState);
        // BridgeActivity 는 라이브러리 레이아웃(capacitor_bridge_layout_main)을 inflate 하므로
        // activity_main.xml 의 WebView 속성은 실제로 쓰이지 않는다 — 오버스크롤 글로우 이펙트는
        // 여기서 실제 bridge WebView 인스턴스에 직접 적용해야 한다.
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);

        // Capacitor 8.3.0 이 Android 16(edge-to-edge) 키보드/스크롤-뒤로가기 회귀를 코어 레벨에서
        // 고쳤지만(ionic-team/capacitor#8329), Android 9(API 28) 이하에서는 같은 fix가 반대로
        // 키보드-콘텐츠 사이 빈 공간을 만드는 부작용이 있어 아직 별도 처리가 필요하다고
        // 커뮤니티에서 확인됨. minSdkVersion=24라 이 구간 기기가 이론상 존재할 수 있어, 해당
        // OS 버전에서만 이전 동작(SOFT_INPUT_ADJUST_NOTHING)으로 되돌려 회귀를 피한다 — Android
        // 10(Q) 이상에는 영향 없음(코어 fix 그대로 적용됨).
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
        }

        // 앱은 KST 시간대 기반 자체 다크모드 로직(useTimeAwareColorMode)을 갖고 있어 Android
        // 시스템 다크모드 설정과 독립적이다. Android 10+ WebView 의 algorithmic darkening 을
        // 그대로 두면 시스템이 다크모드인데 앱 로직상 낮 시간(light)인 경우처럼 상태가 엇갈릴 때
        // WebView 가 임의로 색을 반전/보정해 앱이 의도한 색상과 충돌한다(전수 UX 점검에서 발견).
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(getBridge().getWebView().getSettings(), false);
        }
    }
}
