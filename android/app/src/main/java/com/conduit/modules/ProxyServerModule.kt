package com.conduit.modules

import com.facebook.react.bridge.*
import com.conduit.proxy.HttpProxyServer
import com.conduit.service.ConduitForegroundService
import java.net.InetAddress

class ProxyServerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ProxyServerModule"
        private const val MAX_BIND_RETRIES = 10
        private const val BIND_RETRY_DELAY_MS = 500L
        private const val DEFAULT_BIND = "192.168.49.1"
    }

    override fun getName() = NAME

    @Volatile
    private var server: HttpProxyServer? = null

    @ReactMethod
    fun startServer(port: Int, promise: Promise) {
        Thread {
            var lastError: Exception? = null
            for (attempt in 1..MAX_BIND_RETRIES) {
                val bindAddress = resolveGroupOwnerAddress()
                android.util.Log.d("ProxyServerModule", "Attempt $attempt: binding to $bindAddress:$port")
                try {
                    val s = HttpProxyServer(port, bindAddress)
                    s.start()
                    server = s
                    ConduitForegroundService.registerCleanup { s.stop(); server = null }
                    val result = Arguments.createMap()
                    result.putInt("port", port)
                    result.putString("address", bindAddress)
                    promise.resolve(result)
                    return@Thread
                } catch (e: InterruptedException) {
                    Thread.currentThread().interrupt()
                    promise.reject("START_INTERRUPTED", "Server start interrupted")
                    return@Thread
                } catch (e: Exception) {
                    android.util.Log.w("ProxyServerModule", "Attempt $attempt failed: ${e.message}")
                    lastError = e
                    try {
                        Thread.sleep(BIND_RETRY_DELAY_MS)
                    } catch (ie: InterruptedException) {
                        Thread.currentThread().interrupt()
                        promise.reject("START_INTERRUPTED", "Server start interrupted during retry delay")
                        return@Thread
                    }
                }
            }
            promise.reject("START_FAILED", lastError?.message ?: "Bind failed after retries")
        }.start()
    }

    private fun resolveGroupOwnerAddress(): String {
        val ifaces = java.net.NetworkInterface.getNetworkInterfaces() ?: return DEFAULT_BIND
        for (iface in ifaces) {
            val name = iface.name
            if (!name.startsWith("p2p") && !name.startsWith("p2p-")) continue
            for (addr in iface.inetAddresses) {
                if (addr is java.net.Inet4Address && !addr.isLoopbackAddress) {
                    return addr.hostAddress ?: continue
                }
            }
        }
        return DEFAULT_BIND
    }

    @ReactMethod
    fun stopServer(promise: Promise) {
        try {
            server?.stop()
            server = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_FAILED", e.message)
        }
    }

    @ReactMethod
    fun getStats(promise: Promise) {
        val s = server
        val result = Arguments.createMap()
        result.putInt("activeConnections", s?.activeConnections?.get() ?: 0)
        result.putInt("totalConnections", s?.totalConnections?.get()?.toInt() ?: 0)
        result.putDouble("bytesTransferred", s?.bytesTransferred?.get()?.toDouble() ?: 0.0)
        promise.resolve(result)
    }
}
