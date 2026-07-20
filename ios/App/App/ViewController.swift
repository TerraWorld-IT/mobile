import Capacitor
import UIKit

class ViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        // 앱-로컬 플러그인 등록 (인스타 스토리 직접 공유 — InstagramStoriesPlugin.swift).
        bridge?.registerPluginInstance(InstagramStoriesPlugin())

        // Android는 시스템 하드웨어 뒤로가기(App.addListener('backButton', ...))로 뒤로가기가
        // 되지만, iOS는 그런 시스템 버튼이 없고 앱 안에도 대부분 화면에 뒤로가기 UI가 없어
        // 사용자가 서브 화면에 들어가면 나올 방법이 없었다(실사용자 리포트). WKWebView의
        // 기본 edge-swipe 뒤로가기 제스처(Capacitor 기본값 false)를 켜서, Vue Router의
        // client-side pushState 히스토리도 WKWebView 자체 back-forward 목록에 반영되는
        // 표준 동작을 활용해 iOS 네이티브 스와이프 뒤로가기를 지원한다.
        webView?.allowsBackForwardNavigationGestures = true
    }
}
