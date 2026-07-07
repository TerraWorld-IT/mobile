package app.terraworld.mobile;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // BridgeActivity 는 라이브러리 레이아웃(capacitor_bridge_layout_main)을 inflate 하므로
        // activity_main.xml 의 WebView 속성은 실제로 쓰이지 않는다 — 오버스크롤 글로우 이펙트는
        // 여기서 실제 bridge WebView 인스턴스에 직접 적용해야 한다.
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
}
