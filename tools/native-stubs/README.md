Compile-time stubs for the few React Native Android classes that
ArchiveFilesModule uses. They let `tools/build-plugin.sh` compile the module
with plain `javac` (no Android Studio, no Gradle). The stubs are NOT packaged:
at run time, PluginHost provides the real React Native classes.

Every signature here matches React Native 0.79 exactly (method descriptors
must match for the calls to link on the device).
