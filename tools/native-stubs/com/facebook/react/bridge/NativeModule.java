package com.facebook.react.bridge;
public interface NativeModule {
  String getName();
  void initialize();
  void invalidate();
}
