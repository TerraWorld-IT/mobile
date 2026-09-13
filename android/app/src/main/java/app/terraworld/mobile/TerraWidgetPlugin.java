package app.terraworld.mobile;

import android.graphics.BitmapFactory;
import android.util.AtomicFile;
import android.util.Base64;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

/** 앱 로컬 PNG 브리지. 자격증명·네트워크 요청·외부 노출 file URI 없음. */
@CapacitorPlugin(name = "TerraWidget")
public class TerraWidgetPlugin extends Plugin {
    static final String FILE_NAME = "terra-widget.png";
    static final Object FILE_LOCK = new Object();

    @PluginMethod
    public void saveSnapshot(PluginCall call) {
        String value = call.getString("pngBase64");
        if (value == null || !value.startsWith("data:image/png;base64,") || value.length() > 1_000_000) {
            call.reject("Invalid widget PNG");
            return;
        }
        try {
            byte[] png = Base64.decode(value.substring(22), Base64.NO_WRAP);
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(png, 0, png.length, bounds);
            if (!"image/png".equals(bounds.outMimeType) || bounds.outWidth != 320 || bounds.outHeight != 442) {
                call.reject("Widget PNG must be 320x442");
                return;
            }
            synchronized (FILE_LOCK) {
                AtomicFile file = new AtomicFile(new File(getContext().getFilesDir(), FILE_NAME));
                FileOutputStream stream = null;
                try {
                    stream = file.startWrite();
                    stream.write(png);
                    file.finishWrite(stream);
                } catch (Exception error) {
                    if (stream != null) file.failWrite(stream);
                    throw error;
                }
            }
            TerraWidgetProvider.refresh(getContext());
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not save widget snapshot");
        }
    }

    @PluginMethod
    public void clearSnapshot(PluginCall call) {
        try {
            synchronized (FILE_LOCK) {
                new AtomicFile(new File(getContext().getFilesDir(), FILE_NAME)).delete();
            }
            TerraWidgetProvider.refresh(getContext());
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not clear widget snapshot");
        }
    }
}
