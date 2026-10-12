import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * 輕觸震動反饋 (按鈕、晶片點擊)
 */
export async function hapticLight(): Promise<void> {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}

/**
 * 中度震動反饋 (長按、切換模式)
 */
export async function hapticMedium(): Promise<void> {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
}

/**
 * 成功震動反饋 (記帳成功、儲存成功)
 */
export async function hapticSuccess(): Promise<void> {
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
}

/**
 * 警示震動反饋 (超支、刪除確認)
 */
export async function hapticWarning(): Promise<void> {
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {}
}
