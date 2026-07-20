package app.terraworld.mobile;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

/**
 * 인스타그램 스토리 직접 공유 (Meta "Sharing to Stories" Android 계약).
 *
 * 표준 시스템 공유 시트(@capacitor/share)로는 스토리 카메라 위 스티커 배치가 불가능해
 * 앱-로컬 플러그인으로 구현 (2026-07-21 사용자 요구 — 테라리움 투명 스티커 + 카메라 연계).
 *
 * - 스티커 PNG(base64, 투명 배경)를 앱 cache 에 쓰고 FileProvider URI 로
 *   `com.instagram.share.ADD_TO_STORY` intent 의 `interactive_asset_uri` 에 전달한다.
 * - Android 11+ 패키지 가시성: AndroidManifest 의 <queries> 에 com.instagram.android 선언 필수.
 * - 미설치/실패 시 opened=false — 웹 레이어가 시스템 공유 시트로 폴백한다 (폴백 제거 금지).
 * - ⚠️ 실기기 QA 필요: Instagram 버전별 intent 처리·URI grant 는 에뮬레이터/정적 검증 불가.
 */
@CapacitorPlugin(name = "InstagramStories")
public class InstagramStoriesPlugin extends Plugin {

    private static final String STORY_ACTION = "com.instagram.share.ADD_TO_STORY";
    private static final String IG_PACKAGE = "com.instagram.android";
    private static final String STICKER_FILE = "instagram-story-sticker.png";

    @PluginMethod
    public void isAvailable(PluginCall call) {
        boolean installed;
        try {
            getContext().getPackageManager().getPackageInfo(IG_PACKAGE, 0);
            installed = true;
        } catch (PackageManager.NameNotFoundException e) {
            installed = false;
        }
        JSObject ret = new JSObject();
        ret.put("available", installed);
        call.resolve(ret);
    }

    @PluginMethod
    public void shareSticker(PluginCall call) {
        String stickerBase64 = call.getString("stickerBase64");
        if (stickerBase64 == null || stickerBase64.isEmpty()) {
            call.reject("stickerBase64 is required");
            return;
        }
        String sourceApplication = call.getString("sourceApplication", "");
        String topColor = call.getString("topColor", "#FFF8EB");
        String bottomColor = call.getString("bottomColor", "#DFF3E8");

        try {
            // data URL prefix 허용 (웹 canvas.toDataURL 출력 그대로 수신 가능하게).
            int comma = stickerBase64.indexOf(',');
            String raw = comma >= 0 ? stickerBase64.substring(comma + 1) : stickerBase64;
            byte[] png = Base64.decode(raw, Base64.DEFAULT);

            File file = new File(getContext().getCacheDir(), STICKER_FILE);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(png);
            }

            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );

            Intent intent = new Intent(STORY_ACTION)
                .setPackage(IG_PACKAGE)
                .setType("image/png")
                .putExtra("source_application", sourceApplication)
                .putExtra("interactive_asset_uri", contentUri)
                .putExtra("top_background_color", topColor)
                .putExtra("bottom_background_color", bottomColor)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            // extra 로 전달되는 URI 는 intent flag 만으로 수신측 권한이 보장되지 않는다 —
            // Instagram 패키지에 명시 grant (Meta 문서 계약).
            getContext().grantUriPermission(IG_PACKAGE, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);

            if (intent.resolveActivity(getContext().getPackageManager()) == null) {
                JSObject ret = new JSObject();
                ret.put("opened", false);
                call.resolve(ret);
                return;
            }
            getActivity().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("story share failed: " + e.getMessage());
        }
    }
}
