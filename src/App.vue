<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { onMounted, onUnmounted } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { getSupabaseClient } from '../lib/supabase/client';

const $q = useQuasar();
const router = useRouter();
let appUrlOpenListener: PluginListenerHandle | undefined;
let lastHandledCallbackUrl = '';

onMounted(() => {
  if (Capacitor.isNativePlatform()) void listenForNativeAuthCallbacks();
});

onUnmounted(() => {
  void appUrlOpenListener?.remove();
});

async function listenForNativeAuthCallbacks() {
  try {
    appUrlOpenListener = await CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      void handleNativeAuthCallback(url);
    });
    const launch = await CapacitorApp.getLaunchUrl();
    if (launch?.url) await handleNativeAuthCallback(launch.url);
  } catch (error) {
    $q.notify({
      type: 'negative',
      message:
        error instanceof Error
          ? error.message
          : 'Unable to initialize the native sign-in callback.',
      position: 'bottom',
    });
  }
}

async function handleNativeAuthCallback(url: string) {
  if (url === lastHandledCallbackUrl) return;
  lastHandledCallbackUrl = url;

  try {
    const callback = new URL(url);
    const flow = callback.searchParams.get('flow');
    const callbackError =
      callback.searchParams.get('error_description') || callback.searchParams.get('error');
    if (callbackError) throw new Error(callbackError);

    const auth = getSupabaseClient().auth;
    const code = callback.searchParams.get('code');
    if (code) {
      const { error } = await auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else {
      const tokens = new URLSearchParams(callback.hash.slice(1));
      const accessToken = tokens.get('access_token');
      const refreshToken = tokens.get('refresh_token');
      if (!accessToken || !refreshToken) {
        throw new Error('The sign-in link did not include a valid authorization code.');
      }
      const { error } = await auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
    }

    if (flow === 'recovery') {
      await router.replace('/auth/reset-password');
    } else if (flow === 'admin') {
      await router.replace('/admin');
    } else {
      const { data, error } = await auth.getSession();
      if (error) throw error;
      await router.replace(
        data.session
          ? '/library'
          : flow === 'signup'
            ? { path: '/login', query: { signup: 'confirmed' } }
            : '/login',
      );
    }

    try {
      await Browser.close();
    } catch (error) {
      $q.notify({
        type: 'warning',
        message:
          error instanceof Error ? error.message : 'The sign-in browser could not be closed.',
        position: 'bottom',
      });
    }
  } catch (error) {
    lastHandledCallbackUrl = '';
    $q.notify({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Unable to complete sign-in.',
      position: 'bottom',
    });
    await router.replace('/login');
  }
}
</script>
