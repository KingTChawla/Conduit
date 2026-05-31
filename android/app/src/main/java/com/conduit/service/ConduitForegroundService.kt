package com.conduit.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.conduit.MainActivity
import com.conduit.R
import java.util.concurrent.CopyOnWriteArrayList

class ConduitForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var startTimeMs: Long = 0
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var notificationManager: NotificationManager
    private lateinit var tapIntent: PendingIntent

    private val tickRunnable = object : Runnable {
        override fun run() {
            updateNotification()
            handler.postDelayed(this, 1000)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createChannel()
        startTimeMs = SystemClock.elapsedRealtime()

        tapIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                action = Intent.ACTION_MAIN
                addCategory(Intent.CATEGORY_LAUNCHER)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification("00:00:00"),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
        )

        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Conduit::Hotspot").apply {
            acquire(MAX_WAKELOCK_MS)
        }

        handler.removeCallbacks(tickRunnable)
        handler.postDelayed(tickRunnable, 1000)

        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(tickRunnable)
        wakeLock?.let { if (it.isHeld) it.release() }
        peerCount = 0
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        cleanupCallbacks.forEach { try { it() } catch (_: Exception) {} }
        cleanupCallbacks.clear()
        handler.removeCallbacks(tickRunnable)
        wakeLock?.let { if (it.isHeld) it.release() }
        peerCount = 0
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(duration: String): android.app.Notification {
        val peers = peerCount
        val subtitle = if (peers == 0) {
            "Uptime $duration"
        } else {
            "$peers device${if (peers != 1) "s" else ""} connected • $duration"
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Conduit Hotspot Active")
            .setContentText(subtitle)
            .setSmallIcon(R.drawable.ic_notif_hotspot)
            .setContentIntent(tapIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    private fun updateNotification() {
        val elapsed = (SystemClock.elapsedRealtime() - startTimeMs) / 1000
        val h = elapsed / 3600
        val m = (elapsed % 3600) / 60
        val s = elapsed % 60
        val duration = String.format("%02d:%02d:%02d", h, m, s)
        notificationManager.notify(NOTIFICATION_ID, buildNotification(duration))
    }

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Conduit Hotspot",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            setSound(null, null)
            enableVibration(false)
        }
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }

    companion object {
        const val CHANNEL_ID = "conduit_hotspot_v2"
        const val NOTIFICATION_ID = 1001
        private const val MAX_WAKELOCK_MS = 4 * 60 * 60 * 1000L

        @Volatile
        var peerCount: Int = 0

        private val cleanupCallbacks = CopyOnWriteArrayList<() -> Unit>()

        fun registerCleanup(callback: () -> Unit) {
            cleanupCallbacks.add(callback)
        }

        fun clearCallbacks() {
            cleanupCallbacks.clear()
        }
    }
}
