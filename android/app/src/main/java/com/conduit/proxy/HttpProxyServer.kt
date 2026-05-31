package com.conduit.proxy

import android.util.Log
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

class HttpProxyServer(private val port: Int, private val bindAddress: String = "192.168.49.1") {

    @Volatile
    private var serverSocket: ServerSocket? = null
    private val pool = Executors.newFixedThreadPool(64)
    val activeConnections = AtomicInteger(0)
    val totalConnections = AtomicLong(0)
    val bytesTransferred = AtomicLong(0)
    private val relayThreads = CopyOnWriteArrayList<Thread>()

    @Volatile
    private var running = false

    fun start() {
        synchronized(this) {
            running = true
            serverSocket = ServerSocket(port, 50, InetAddress.getByName(bindAddress))
        }
        pool.execute {
            while (running) {
                try {
                    val client = serverSocket?.accept() ?: break
                    pool.execute { handleClient(client) }
                } catch (e: Exception) {
                    if (running) Log.e("HttpProxyServer", "Accept error", e)
                    break
                }
            }
        }
    }

    fun stop() {
        synchronized(this) {
            running = false
            try { serverSocket?.close() } catch (_: Exception) {}
        }
        pool.shutdownNow()
        for (t in relayThreads) t.interrupt()
    }

    private fun handleClient(client: Socket) {
        activeConnections.incrementAndGet()
        totalConnections.incrementAndGet()
        try {
            client.soTimeout = 30_000
            val input = client.getInputStream()
            val output = client.getOutputStream()

            val firstLine = readLine(input) ?: return
            val parts = firstLine.trim().split(" ")
            if (parts.size < 3) return

            val method = parts[0]
            val uri = parts[1]

            if (method == "CONNECT") {
                handleConnect(client, input, output, uri)
            } else {
                handleHttp(client, input, output, method, uri, firstLine)
            }
        } catch (e: Exception) {
            Log.e("HttpProxyServer", "Client handling error", e)
        } finally {
            activeConnections.decrementAndGet()
            try { client.close() } catch (_: Exception) {}
        }
    }

    private fun handleConnect(client: Socket, input: InputStream, output: OutputStream, uri: String) {
        val colonIdx = uri.lastIndexOf(':')
        val host = if (colonIdx > 0) uri.substring(0, colonIdx) else uri
        val port = if (colonIdx > 0) uri.substring(colonIdx + 1).toIntOrNull() ?: 443 else 443

        if (port !in 1..65535) {
            output.write("HTTP/1.1 400 Bad Request\r\n\r\n".toByteArray())
            output.flush()
            return
        }

        if (isBlockedTarget(host)) {
            output.write("HTTP/1.1 403 Forbidden\r\n\r\n".toByteArray())
            output.flush()
            return
        }

        drainHeaders(input)

        val target = try { Socket(host, port) } catch (e: Exception) {
            output.write("HTTP/1.1 502 Bad Gateway\r\n\r\n".toByteArray())
            output.flush()
            return
        }

        try {
            output.write("HTTP/1.1 200 Connection Established\r\n\r\n".toByteArray())
            output.flush()

            val t1 = Thread { relay(input, target.getOutputStream()) }
            val t2 = Thread { relay(target.getInputStream(), output) }
            t1.isDaemon = true
            t2.isDaemon = true
            relayThreads.add(t1)
            relayThreads.add(t2)
            t1.start()
            t2.start()
            try {
                t1.join()
                t2.join()
            } catch (_: InterruptedException) {
                t1.interrupt()
                t2.interrupt()
            }
        } finally {
            try { target.close() } catch (_: Exception) {}
        }
    }

    private fun handleHttp(
        client: Socket,
        input: InputStream,
        output: OutputStream,
        method: String,
        uri: String,
        firstLine: String
    ) {
        val url = try { java.net.URL(uri) } catch (e: Exception) { return }
        val host = url.host
        val port = if (url.port != -1) url.port else 80

        if (isBlockedTarget(host)) return

        val headers = StringBuilder()
        headers.append("$method ${url.file.ifEmpty { "/" }} HTTP/1.1\r\n")

        var line = readLine(input)
        while (line != null && line.isNotEmpty()) {
            if (!line.startsWith("Proxy-", ignoreCase = true)) {
                headers.append("$line\r\n")
            }
            line = readLine(input)
        }
        headers.append("\r\n")

        val target = try { Socket(host, port) } catch (e: Exception) { return }
        target.soTimeout = 30_000

        try {
            val targetOut = target.getOutputStream()
            val targetIn = target.getInputStream()
            targetOut.write(headers.toString().toByteArray())
            targetOut.flush()

            val t1 = Thread { relay(input, targetOut) }
            val t2 = Thread { relay(targetIn, output) }
            t1.isDaemon = true
            t2.isDaemon = true
            relayThreads.add(t1)
            relayThreads.add(t2)
            t1.start()
            t2.start()
            try {
                t1.join()
                t2.join()
            } catch (_: InterruptedException) {
                t1.interrupt()
                t2.interrupt()
            }
        } finally {
            try { target.close() } catch (_: Exception) {}
        }
    }

    private fun isBlockedTarget(host: String): Boolean {
        val addr = try { InetAddress.getByName(host) } catch (_: Exception) { return true }
        if (addr.isLoopbackAddress || addr.isLinkLocalAddress || addr.isAnyLocalAddress) return true
        val ip = addr.hostAddress ?: return true
        if (ip.startsWith("192.168.49.")) return true
        return false
    }

    private fun relay(from: InputStream, to: OutputStream) {
        val buf = ByteArray(32 * 1024)
        val t = Thread.currentThread()
        try {
            var n = from.read(buf)
            while (n >= 0) {
                to.write(buf, 0, n)
                to.flush()
                bytesTransferred.addAndGet(n.toLong())
                n = from.read(buf)
            }
        } catch (e: Exception) {
            Log.d("HttpProxyServer", "Relay ended", e)
        } finally {
            relayThreads.remove(t)
        }
    }

    private fun readLine(input: InputStream): String? {
        val sb = StringBuilder()
        var b = input.read()
        while (b != -1 && b != '\n'.code) {
            if (b != '\r'.code) {
                if (sb.length >= MAX_LINE_LENGTH) throw IOException("Request line too long")
                sb.append(b.toChar())
            }
            b = input.read()
        }
        return if (b == -1 && sb.isEmpty()) null else sb.toString()
    }

    private fun drainHeaders(input: InputStream) {
        var line = readLine(input)
        while (line != null && line.isNotEmpty()) {
            line = readLine(input)
        }
    }

    companion object {
        private const val MAX_LINE_LENGTH = 8192
    }
}
