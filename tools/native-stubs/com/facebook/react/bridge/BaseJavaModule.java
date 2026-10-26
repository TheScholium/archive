package com.facebook.react.bridge;
public abstract class BaseJavaModule implements NativeModule {
  public BaseJavaModule() {}
  public BaseJavaModule(ReactApplicationContext reactContext) {}
  public void initialize() {}
  public void invalidate() {}
}
