package com.conduit.modules

import android.content.Context
import com.facebook.react.bridge.*

class PreferencesModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "PreferencesModule"
        private const val PREFS_NAME = "conduit_prefs"
    }

    override fun getName() = NAME

    private val prefs by lazy {
        reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    @ReactMethod
    fun getString(key: String, fallback: String, promise: Promise) {
        promise.resolve(prefs.getString(key, fallback))
    }

    @ReactMethod
    fun setString(key: String, value: String, promise: Promise) {
        prefs.edit().putString(key, value).apply()
        promise.resolve(null)
    }
}
