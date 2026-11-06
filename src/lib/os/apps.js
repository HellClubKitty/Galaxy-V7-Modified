import browser from '$lib/img/icons/earthWhite.png';
import apps from '$lib/img/icons/apps.png';
import settings from '$lib/img/icons/settings.png';

/** Built-in apps. */
export function baseApps() {
	return [
		{ id: 'browser', name: 'Browser', url: '/slate', icon: browser, tint: '#2f6fd0', width: '62%', height: '70%' },
		{ id: 'apps', name: 'Apps', url: '/apps', icon: apps, tint: '#c2571a', width: '62%', height: '70%' },
		{ id: 'settings', name: 'Settings', url: '/settings?tab=desktop', icon: settings, tint: '#5b6068', width: '78%', height: '78%' }
	];
}
