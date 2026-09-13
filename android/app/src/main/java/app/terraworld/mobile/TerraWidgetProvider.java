package app.terraworld.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.view.View;
import android.widget.RemoteViews;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileInputStream;

public class TerraWidgetProvider extends AppWidgetProvider {
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TerraWidgetProvider.class));
        if (ids.length > 0) new TerraWidgetProvider().onUpdate(context, manager, ids);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        Bitmap bitmap = null;
        synchronized (TerraWidgetPlugin.FILE_LOCK) {
            AtomicFile file = new AtomicFile(new File(context.getFilesDir(), TerraWidgetPlugin.FILE_NAME));
            try (FileInputStream input = file.openRead()) {
                bitmap = BitmapFactory.decodeStream(input);
            } catch (Exception ignored) { /* 스냅샷 없음: placeholder 표시. */ }
        }
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.terra_widget);
        views.setViewVisibility(R.id.terra_widget_placeholder, bitmap == null ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.terra_widget_image, bitmap == null ? View.GONE : View.VISIBLE);
        views.setImageViewBitmap(R.id.terra_widget_image, bitmap);
        Intent open = new Intent(context, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.terra_widget_root, pending);
        manager.updateAppWidget(ids, views);
    }
}
