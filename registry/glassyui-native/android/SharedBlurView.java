package eightbitlab.com.blurview;

import android.content.Context;
import android.graphics.Color;
import android.os.Build;

/** Keeps Expo's BlurView API while sharing its Android 12+ backdrop filters. */
public final class SharedBlurView extends BlurView {
    private int sharedOverlayColor = Color.TRANSPARENT;

    public SharedBlurView(Context context) {
        super(context);
    }

    @Override
    public BlurViewFacade setupWith(
            BlurTarget target, BlurAlgorithm algorithm, float scaleFactor, boolean applyNoise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return super.setupWith(target, algorithm, scaleFactor, applyNoise);
        }

        blurController.destroy();
        blurController = new SharedBlurController(
                this, target, sharedOverlayColor, scaleFactor, applyNoise);
        return blurController;
    }

    @Override
    public BlurViewFacade setOverlayColor(int color) {
        sharedOverlayColor = color;
        return super.setOverlayColor(color);
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        if (blurController instanceof SharedBlurController) {
            ((SharedBlurController) blurController).attach();
        }
    }

    @Override
    protected void onDetachedFromWindow() {
        if (blurController instanceof SharedBlurController) {
            ((SharedBlurController) blurController).detach();
        }
        super.onDetachedFromWindow();
    }
}
