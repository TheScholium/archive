package com.facebook.react.bridge;
public interface WritableMap extends ReadableMap {
  void putBoolean(String key, boolean value);
  void putDouble(String key, double value);
  void putString(String key, String value);
}
