package app.terraworld.mobile;

import android.os.Bundle;
import android.view.View;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // BridgeActivity 는 라이브러리 레이아웃(capacitor_bridge_layout_main)을 inflate 하므로
        // activity_main.xml 의 WebView 속성은 실제로 쓰이지 않는다 — 오버스크롤 글로우 이펙트는
        // 여기서 실제 bridge WebView 인스턴스에 직접 적용해야 한다.
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);

        // 앱은 KST 시간대 기반 자체 다크모드 로직(useTimeAwareColorMode)을 갖고 있어 Android
        // 시스템 다크모드 설정과 독립적이다. Android 10+ WebView 의 algorithmic darkening 을
        // 그대로 두면 시스템이 다크모드인데 앱 로직상 낮 시간(light)인 경우처럼 상태가 엇갈릴 때
        // WebView 가 임의로 색을 반전/보정해 앱이 의도한 색상과 충돌한다(전수 UX 점검에서 발견).
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(getBridge().getWebView().getSettings(), false);
        }
    }
}
