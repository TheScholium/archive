package com.archive.files;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Registers {@link ArchiveFilesModule}. PluginHost loads this class from
 * the plugin's app.npk (see "reactPackages" in PluginConfig.json).
 *
 * All three ReactPackage methods are implemented so that the module is
 * found on both the old (bridge) and the new (TurboModule interop) paths.
 */
public class ArchiveFilesPackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new ArchiveFilesModule(reactContext));
        return modules;
    }

    @Override
    @SuppressWarnings({"rawtypes", "unchecked"})
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

    @Override
    public NativeModule getModule(String name, ReactApplicationContext reactContext) {
        if (ArchiveFilesModule.NAME.equals(name)) {
            return new ArchiveFilesModule(reactContext);
        }
        return null;
    }
}
