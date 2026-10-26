package com.archive.files;

import android.util.Base64;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.Charset;

/**
 * Small file API for the Scholium Archive plugin. sn-plugin-lib has no call that
 * writes arbitrary text or bytes, so this module adds one.
 *
 * Supernote's plugin permission system still applies: the JS side asks for
 * plugin.permission.FILE:READ / FILE:WRITE before it calls these methods
 * for paths in shared storage.
 *
 * Java 8 language level, java.io only, no third-party dependencies.
 */
public class ArchiveFilesModule extends ReactContextBaseJavaModule {

    public static final String NAME = "ArchiveFiles";
    private static final Charset UTF8 = Charset.forName("UTF-8");
    private static final long MAX_READ = 16L * 1024L * 1024L;

    public ArchiveFilesModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return NAME;
    }

    /** Returns the module version, so that JS can check that it loaded. */
    @ReactMethod
    public void version(Promise promise) {
        promise.resolve("1.0.0");
    }

    @ReactMethod
    public void readText(String path, Promise promise) {
        try {
            File f = new File(path);
            if (!f.isFile()) {
                promise.reject("ENOENT", "File not found: " + path);
                return;
            }
            if (f.length() > MAX_READ) {
                promise.reject("EFBIG", "File is larger than 16 MB: " + path);
                return;
            }
            promise.resolve(new String(readAll(f), UTF8));
        } catch (Throwable t) {
            promise.reject("EREAD", describe(t));
        }
    }

    @ReactMethod
    public void writeText(String path, String text, Promise promise) {
        try {
            writeAtomic(new File(path), (text == null ? "" : text).getBytes(UTF8));
            promise.resolve(true);
        } catch (Throwable t) {
            promise.reject("EWRITE", describe(t));
        }
    }

    @ReactMethod
    public void writeBase64(String path, String data, Promise promise) {
        try {
            byte[] bytes = Base64.decode(data == null ? "" : data, Base64.DEFAULT);
            writeAtomic(new File(path), bytes);
            promise.resolve(true);
        } catch (Throwable t) {
            promise.reject("EWRITE", describe(t));
        }
    }

    @ReactMethod
    public void exists(String path, Promise promise) {
        try {
            promise.resolve(new File(path).exists());
        } catch (Throwable t) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void mkdirs(String path, Promise promise) {
        try {
            File d = new File(path);
            promise.resolve(d.isDirectory() || d.mkdirs());
        } catch (Throwable t) {
            promise.reject("EMKDIR", describe(t));
        }
    }

    /** Lists a directory: [{name, path, isDir, size, modified}], or [] if missing. */
    @ReactMethod
    public void listDir(String path, Promise promise) {
        try {
            WritableArray out = Arguments.createArray();
            File[] files = new File(path).listFiles();
            if (files != null) {
                for (File f : files) {
                    WritableMap m = Arguments.createMap();
                    m.putString("name", f.getName());
                    m.putString("path", f.getAbsolutePath());
                    m.putBoolean("isDir", f.isDirectory());
                    m.putDouble("size", (double) f.length());
                    m.putDouble("modified", (double) f.lastModified());
                    out.pushMap(m);
                }
            }
            promise.resolve(out);
        } catch (Throwable t) {
            promise.reject("ELIST", describe(t));
        }
    }

    /**
     * Lists all files under a folder, recursively: [{path, rel, name, size, modified}].
     * Skips hidden files and folders (".obsidian", ".trash", ".git", ...).
     * Stops after maxFiles entries.
     */
    @ReactMethod
    public void listTree(String root, double maxFiles, Promise promise) {
        try {
            WritableArray out = Arguments.createArray();
            File base = new File(root);
            int[] count = new int[] {0};
            int limit = maxFiles > 0 ? (int) maxFiles : 20000;
            String basePath = base.getAbsolutePath();
            walk(base, basePath, out, count, limit, 0);
            promise.resolve(out);
        } catch (Throwable t) {
            promise.reject("ELIST", describe(t));
        }
    }

    private static void walk(File dir, String basePath, WritableArray out, int[] count, int limit, int depth) {
        if (depth > 24 || count[0] >= limit) return;
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (count[0] >= limit) return;
            String name = f.getName();
            if (name.startsWith(".")) continue;
            if (f.isDirectory()) {
                walk(f, basePath, out, count, limit, depth + 1);
            } else {
                String abs = f.getAbsolutePath();
                WritableMap m = Arguments.createMap();
                m.putString("path", abs);
                m.putString("rel", abs.length() > basePath.length() + 1 ? abs.substring(basePath.length() + 1) : name);
                m.putString("name", name);
                m.putDouble("size", (double) f.length());
                m.putDouble("modified", (double) f.lastModified());
                out.pushMap(m);
                count[0]++;
            }
        }
    }

    @ReactMethod
    public void rename(String from, String to, Promise promise) {
        try {
            File src = new File(from);
            File dst = new File(to);
            if (!src.exists()) {
                promise.reject("ENOENT", "File not found: " + from);
                return;
            }
            if (dst.exists()) {
                promise.reject("EEXIST", "A file with that name exists: " + to);
                return;
            }
            File parent = dst.getParentFile();
            if (parent != null && !parent.isDirectory()) parent.mkdirs();
            promise.resolve(src.renameTo(dst));
        } catch (Throwable t) {
            promise.reject("ERENAME", describe(t));
        }
    }

    /**
     * Copies a file (for example the lasso preview PNG from the plugin's private
     * folder into the vault). Resolves true when the copy exists afterwards.
     */
    @ReactMethod
    public void copyFile(String from, String to, Promise promise) {
        InputStream in = null;
        OutputStream out = null;
        try {
            File src = new File(from);
            if (!src.isFile()) {
                promise.reject("ENOENT", "File not found: " + from);
                return;
            }
            File dst = new File(to);
            File parent = dst.getAbsoluteFile().getParentFile();
            if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
                promise.reject("EMKDIR", "Cannot create folder: " + parent);
                return;
            }
            in = new FileInputStream(src);
            out = new FileOutputStream(dst);
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            out.flush();
            closeQuietly(out);
            out = null;
            promise.resolve(dst.isFile() && dst.length() == src.length());
        } catch (Throwable t) {
            promise.reject("ECOPY", describe(t));
        } finally {
            closeQuietly(in);
            closeQuietly(out);
        }
    }

    @ReactMethod
    public void deleteFile(String path, Promise promise) {
        try {
            File f = new File(path);
            promise.resolve(!f.exists() || (f.isFile() && f.delete()));
        } catch (Throwable t) {
            promise.reject("EDELETE", describe(t));
        }
    }

    /* ------------------------------------------------------------ */

    private static byte[] readAll(File f) throws IOException {
        InputStream in = new FileInputStream(f);
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream((int) Math.max(16, f.length()));
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            return bos.toByteArray();
        } finally {
            closeQuietly(in);
        }
    }

    /** Writes to a temporary file first, then renames, so a failed write cannot destroy a note. */
    private static void writeAtomic(File target, byte[] bytes) throws IOException {
        File parent = target.getAbsoluteFile().getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
            throw new IOException("Cannot create folder: " + parent);
        }
        File tmp = new File(parent, "." + target.getName() + ".tmp");
        OutputStream out = new FileOutputStream(tmp);
        try {
            out.write(bytes);
            out.flush();
            if (out instanceof FileOutputStream) {
                try {
                    ((FileOutputStream) out).getFD().sync();
                } catch (IOException ignored) {
                    // Some storage does not support fsync; the rename still protects the old file.
                }
            }
        } finally {
            closeQuietly(out);
        }
        if (target.exists() && !target.delete()) {
            // Fall back to a direct write if the old file cannot be removed.
            OutputStream direct = new FileOutputStream(target);
            try {
                direct.write(bytes);
            } finally {
                closeQuietly(direct);
            }
            tmp.delete();
            return;
        }
        if (!tmp.renameTo(target)) {
            OutputStream direct = new FileOutputStream(target);
            try {
                direct.write(bytes);
            } finally {
                closeQuietly(direct);
            }
            tmp.delete();
        }
    }

    private static void closeQuietly(java.io.Closeable c) {
        if (c == null) return;
        try {
            c.close();
        } catch (IOException ignored) {
            // nothing to do
        }
    }

    private static String describe(Throwable t) {
        String m = t.getMessage();
        return t.getClass().getSimpleName() + (m == null ? "" : ": " + m);
    }
}
