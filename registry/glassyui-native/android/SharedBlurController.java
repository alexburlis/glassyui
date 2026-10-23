package eightbitlab.com.blurview;

import android.graphics.BlendMode;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.RecordingCanvas;
import android.graphics.Rect;
import android.graphics.RenderEffect;
import android.graphics.RenderNode;
import android.graphics.Shader;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.view.View;
import android.view.ViewTreeObserver;
import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.Map;
import java.util.WeakHashMap;

/** Shares only the filtered backdrop; each surface retains its own material and transform. */
final class SharedBlurController extends RenderNodeBlurController {
    private final BlurView view;
    private final BlurTarget target;
    private final float scaleFactor;
    private final boolean applyNoise;
    private final Pool pool;
    private final RenderNode wrapper = new RenderNode("Glassy UI surface");
    private final int[] targetLocation = new int[2];
    private final int[] viewLocation = new int[2];
    private final ViewTreeObserver.OnPreDrawListener positionListener = () -> {
        updateWrapper();
        return true;
    };

    private ViewTreeObserver positionObserver;
    private Entry entry;
    private Drawable clearDrawable;
    private float radius = 1f;
    private int overlayColor;
    private boolean enabled = true;
    private boolean autoUpdate = true;
    private boolean attached;
    private boolean destroyed;
    private boolean wrapperDirty = true;
    private int wrapperWidth = -1;
    private int wrapperHeight = -1;

    SharedBlurController(
            BlurView view, BlurTarget target, int overlayColor, float scaleFactor, boolean applyNoise) {
        super(view, target, overlayColor, scaleFactor, applyNoise);
        // The superclass remains the software-canvas renderer, without a second position listener.
        super.setBlurAutoUpdate(false);
        this.view = view;
        this.target = target;
        this.overlayColor = overlayColor;
        this.scaleFactor = scaleFactor;
        this.applyNoise = applyNoise;
        pool = Pool.forTarget(target);
        attached = view.isAttachedToWindow();
        if (attached) {
            acquireEntry();
            observePosition();
        }
    }

    @Override
    public boolean draw(Canvas canvas) {
        // Detached hardware captures keep the original per-view RenderNode owner and lifetime.
        if (!canvas.isHardwareAccelerated() || !attached) {
            return super.draw(canvas);
        }
        if (!enabled || destroyed) {
            return true;
        }

        acquireEntry();
        if (!target.renderNode.hasDisplayList()) {
            // A dialog window can draw before the target's first frame.
            view.invalidate();
        }
        if (autoUpdate) {
            entry.ensureRecorded();
        } else {
            // Stock still refreshes on an explicit draw with automatic updates stopped.
            entry.record();
        }
        updateWrapper();
        canvas.drawRenderNode(wrapper);
        if (applyNoise) {
            Noise.apply(canvas, view.getContext(), view.getWidth(), view.getHeight());
        }
        if (overlayColor != Color.TRANSPARENT) {
            canvas.drawColor(overlayColor);
        }
        return true;
    }

    void attach() {
        if (destroyed) {
            return;
        }
        attached = true;
        if (enabled) {
            acquireEntry();
        }
        observePosition();
    }

    void detach() {
        attached = false;
        stopObservingPosition();
        releaseEntry();
    }

    @Override
    public void destroy() {
        if (!destroyed) {
            detach();
            destroyed = true;
            super.destroy();
        }
    }

    @Override
    public void updateBlurViewSize() {
        super.updateBlurViewSize();
        wrapperDirty = true;
        updateWrapper();
    }

    @Override
    public BlurViewFacade setBlurRadius(float radius) {
        super.setBlurRadius(radius);
        if (Float.floatToIntBits(this.radius) != Float.floatToIntBits(radius)) {
            this.radius = radius;
            replaceEntry();
        }
        return this;
    }

    @Override
    public BlurViewFacade setFrameClearDrawable(Drawable drawable) {
        super.setFrameClearDrawable(drawable);
        if (clearDrawable != drawable) {
            clearDrawable = drawable;
            replaceEntry();
        }
        return this;
    }

    @Override
    public BlurViewFacade setOverlayColor(int color) {
        overlayColor = color;
        super.setOverlayColor(color);
        return this;
    }

    @Override
    public BlurViewFacade setBlurEnabled(boolean enabled) {
        super.setBlurEnabled(enabled);
        this.enabled = enabled;
        if (enabled && attached) {
            acquireEntry();
        } else if (!enabled) {
            releaseEntry();
        }
        observePosition();
        return this;
    }

    @Override
    public BlurViewFacade setBlurAutoUpdate(boolean enabled) {
        super.setBlurAutoUpdate(false);
        if (autoUpdate != enabled && entry != null) {
            pool.setAutoUpdate(enabled);
        }
        autoUpdate = enabled;
        observePosition();
        return this;
    }

    @Override
    void updateRotation(float rotation) {
        super.updateRotation(rotation);
        wrapper.setRotationZ(-rotation);
    }

    @Override
    public void updateScaleX(float scaleX) {
        super.updateScaleX(scaleX);
        wrapper.setScaleX(1f / scaleX);
    }

    @Override
    public void updateScaleY(float scaleY) {
        super.updateScaleY(scaleY);
        wrapper.setScaleY(1f / scaleY);
    }

    private void replaceEntry() {
        releaseEntry();
        if (enabled && attached && !destroyed) {
            acquireEntry();
        }
        view.invalidate();
    }

    private void acquireEntry() {
        if (entry == null && !destroyed) {
            entry = pool.acquire(radius * scaleFactor, clearDrawable, autoUpdate);
            wrapperDirty = true;
        }
    }

    private void releaseEntry() {
        wrapper.discardDisplayList();
        wrapperDirty = true;
        if (entry != null) {
            pool.release(entry, autoUpdate);
            entry = null;
        }
    }

    private void updateWrapper() {
        if (entry == null || destroyed) {
            return;
        }
        int width = target.getWidth();
        int height = target.getHeight();
        if (wrapperWidth != width || wrapperHeight != height) {
            wrapperWidth = width;
            wrapperHeight = height;
            wrapper.setPosition(0, 0, width, height);
            wrapperDirty = true;
        }
        if (wrapperDirty || !wrapper.hasDisplayList()) {
            RecordingCanvas recording = wrapper.beginRecording();
            recording.drawRenderNode(entry.node);
            wrapper.endRecording();
            wrapperDirty = false;
        }

        // Match BlurView 3.1's sampling and transform hooks exactly.
        target.getLocationOnScreen(targetLocation);
        view.getLocationOnScreen(viewLocation);
        float translationX = targetLocation[0] - viewLocation[0];
        float translationY = targetLocation[1] - viewLocation[1];
        wrapper.setPivotX(view.getWidth() / 2f - translationX);
        wrapper.setPivotY(view.getHeight() / 2f - translationY);
        wrapper.setTranslationX(translationX);
        wrapper.setTranslationY(translationY);
    }

    private void observePosition() {
        stopObservingPosition();
        if (!destroyed && attached && enabled && autoUpdate) {
            positionObserver = view.getViewTreeObserver();
            positionObserver.addOnPreDrawListener(positionListener);
        }
    }

    private void stopObservingPosition() {
        if (positionObserver != null) {
            ViewTreeObserver observer = positionObserver.isAlive()
                    ? positionObserver : view.getViewTreeObserver();
            if (observer.isAlive()) {
                observer.removeOnPreDrawListener(positionListener);
            }
            positionObserver = null;
        }
    }

    private static final class Key {
        final int radiusBits;
        final Drawable clearDrawable;

        Key(float radius, Drawable clearDrawable) {
            radiusBits = Float.floatToIntBits(radius);
            this.clearDrawable = clearDrawable;
        }

        @Override
        public boolean equals(Object other) {
            if (!(other instanceof Key)) {
                return false;
            }
            Key key = (Key) other;
            return radiusBits == key.radiusBits && clearDrawable == key.clearDrawable;
        }

        @Override
        public int hashCode() {
            return 31 * radiusBits + System.identityHashCode(clearDrawable);
        }
    }

    private static final class Entry {
        final Key key;
        final BlurTarget target;
        final RenderNode node = new RenderNode("Glassy UI shared backdrop");
        final ClearColorProbe clearColor = new ClearColorProbe();
        int users;

        Entry(Key key, BlurTarget target) {
            this.key = key;
            this.target = target;
            applyEffect();
        }

        void applyEffect() {
            float radius = Float.intBitsToFloat(key.radiusBits);
            node.setRenderEffect(
                    RenderEffect.createBlurEffect(radius, radius, Shader.TileMode.CLAMP));
        }

        void ensureRecorded() {
            if (!node.hasDisplayList()
                    || node.getWidth() != target.getWidth()
                    || node.getHeight() != target.getHeight()) {
                record();
            }
        }

        boolean clearChanged() {
            if (key.clearDrawable == null) {
                return false;
            }
            // Exact ColorDrawable drawing includes its private tint filter. Public color
            // getters alone miss tint changes. Other drawables keep their existing refresh.
            if (key.clearDrawable.getClass() != ColorDrawable.class
                    || key.clearDrawable.getColorFilter() != null) {
                return true;
            }
            return clearColor.changed((ColorDrawable) key.clearDrawable);
        }

        void record() {
            if (!target.renderNode.hasDisplayList()) {
                return;
            }
            node.setPosition(0, 0, target.getWidth(), target.getHeight());
            RecordingCanvas recording = node.beginRecording();
            if (key.clearDrawable != null) {
                key.clearDrawable.draw(recording);
            }
            recording.drawRenderNode(target.renderNode);
            node.endRecording();
            // Android 12 needs an explicit effect refresh when its filtered output changes.
            // The shared node itself never receives a surface's rotation, scale or translation.
            if (Build.VERSION.SDK_INT == Build.VERSION_CODES.S) {
                applyEffect();
            }
        }
    }

    /** Observes a solid drawable's effective draw command without rasterizing or changing it. */
    private static final class ClearColorProbe extends Canvas {
        private boolean known;
        private int draws;
        private boolean changed;
        private int color;
        private ColorFilter filter;
        private BlendMode blendMode;
        private final Rect bounds = new Rect();

        boolean changed(ColorDrawable drawable) {
            draws = 0;
            changed = !known;
            drawable.draw(this);
            // An unobserved command stays on the original refresh path, including a fully
            // transparent drawable. Only one recognized solid rectangle can be reused.
            known = draws == 1;
            return changed || !known;
        }

        @Override
        public void drawRect(Rect rectangle, Paint paint) {
            draws++;
            int nextColor = paint.getColor();
            ColorFilter nextFilter = paint.getColorFilter();
            BlendMode nextBlendMode = paint.getBlendMode();
            changed |= draws != 1 || color != nextColor || filter != nextFilter
                    || blendMode != nextBlendMode || !bounds.equals(rectangle);
            color = nextColor;
            filter = nextFilter;
            blendMode = nextBlendMode;
            bounds.set(rectangle);
        }
    }

    private static final class Pool implements View.OnAttachStateChangeListener {
        private static final WeakHashMap<BlurTarget, WeakReference<Pool>> POOLS = new WeakHashMap<>();
        final BlurTarget target;
        final Map<Key, Entry> entries = new HashMap<>();
        final ViewTreeObserver.OnPreDrawListener sourceListener = () -> {
            boolean sourceChanged = sourceIsDirty();
            for (Entry entry : entries.values()) {
                // Foreground-only frames reuse the filtered source. Independently changing
                // clear input still refreshes, including resolved solid-color tint changes.
                if (sourceChanged || entry.clearChanged()) {
                    entry.record();
                } else {
                    entry.ensureRecorded();
                }
            }
            return true;
        };
        ViewTreeObserver sourceObserver;
        int updatingUsers;

        static Pool forTarget(BlurTarget target) {
            WeakReference<Pool> reference = POOLS.get(target);
            Pool pool = reference == null ? null : reference.get();
            if (pool == null) {
                pool = new Pool(target);
                POOLS.put(target, new WeakReference<>(pool));
            }
            return pool;
        }

        Pool(BlurTarget target) {
            this.target = target;
        }

        private boolean sourceIsDirty() {
            // Keep Android 12's explicit refresh: its filtered child cache can stay stale.
            return Build.VERSION.SDK_INT == Build.VERSION_CODES.S || target.isDirty();
        }

        Entry acquire(float radius, Drawable clearDrawable, boolean autoUpdate) {
            Key key = new Key(radius, clearDrawable);
            Entry entry = entries.get(key);
            if (entry == null) {
                entry = new Entry(key, target);
                entries.put(key, entry);
            }
            entry.users++;
            if (autoUpdate) {
                updatingUsers++;
            }
            if (entries.size() == 1 && entry.users == 1) {
                target.addOnAttachStateChangeListener(this);
                observeSource();
            } else if (autoUpdate && updatingUsers == 1) {
                observeSource();
            }
            return entry;
        }

        void release(Entry entry, boolean autoUpdate) {
            entry.users--;
            if (autoUpdate) {
                updatingUsers--;
            }
            if (entry.users == 0) {
                entries.remove(entry.key);
                entry.node.discardDisplayList();
            }
            if (entries.isEmpty()) {
                stopObservingSource();
                target.removeOnAttachStateChangeListener(this);
            } else if (updatingUsers == 0) {
                stopObservingSource();
            }
        }

        void setAutoUpdate(boolean enabled) {
            updatingUsers += enabled ? 1 : -1;
            if (updatingUsers == 0) {
                stopObservingSource();
            } else if (enabled && updatingUsers == 1) {
                observeSource();
            }
        }

        private void observeSource() {
            stopObservingSource();
            if (target.isAttachedToWindow() && updatingUsers > 0) {
                sourceObserver = target.getViewTreeObserver();
                sourceObserver.addOnPreDrawListener(sourceListener);
            }
        }

        private void stopObservingSource() {
            if (sourceObserver != null) {
                ViewTreeObserver observer = sourceObserver.isAlive()
                        ? sourceObserver : target.getViewTreeObserver();
                if (observer.isAlive()) {
                    observer.removeOnPreDrawListener(sourceListener);
                }
                sourceObserver = null;
            }
        }

        @Override
        public void onViewAttachedToWindow(View view) {
            observeSource();
        }

        @Override
        public void onViewDetachedFromWindow(View view) {
            stopObservingSource();
        }
    }
}
