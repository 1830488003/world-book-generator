// SillyTavern Extension Updater for GitHub repositories

import { getRequestHeaders } from '/scripts/script.js';
import { extension_settings } from '/scripts/extensions.js';
import { callPopup, POPUP_TYPE } from '/scripts/ui.js';

const GITHUB_USER = '1830488003';
const GITHUB_REPO = 'world-book-generator';
const GITHUB_BRANCH = 'main';
const MANIFEST_PATH = 'manifest.json';
const CHANGELOG_PATH = 'CHANGELOG.md'; // Assuming you will create this file

const LOCAL_MANIFEST_PATH = `/extensions/third-party/world-book-generator/${MANIFEST_PATH}`;

let localVersion;
let remoteVersion;
let changelogContent;

/**
 * Fetches raw file content from the GitHub repository.
 * @param {string} filePath - The path to the file in the repository.
 * @returns {Promise<string>} The content of the file.
 */
async function fetchRawFileContentFromGitHub(filePath) {
    const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;
    const headers = { 'Cache-Control': 'no-cache' };

    try {
        const response = await fetch(url, { method: 'GET', headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch from GitHub: ${response.status} ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        console.error('[WBG-Updater] Error fetching file from GitHub:', error);
        throw error;
    }
}

/**
 * Parses the version from a JSON file content.
 * @param {string} content - The JSON content.
 * @returns {string} The version string.
 */
function parseVersionFromFile(content) {
    try {
        const data = JSON.parse(content);
        if (data && typeof data.version === 'string') {
            return data.version;
        }
        throw new Error("Invalid manifest format: 'version' field is missing or not a string.");
    } catch (error) {
        console.error('[WBG-Updater] Error parsing version from file:', error);
        throw error;
    }
}

/**
 * Compares two semantic version strings (e.g., "1.2.3").
 * @param {string} versionA
 * @param {string} versionB
 * @returns {number} > 0 if A > B, < 0 if A < B, 0 if A === B.
 */
function compareSemVer(versionA, versionB) {
    const partsA = versionA.split('.').map(Number);
    const partsB = versionB.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA > numB) return 1;
        if (numA < numB) return -1;
    }
    return 0;
}

/**
 * Fetches the local version from the extension's manifest file.
 * @returns {Promise<string>} The local version number.
 */
async function getLocalVersion() {
    if (localVersion) return localVersion;
    try {
        const response = await fetch(LOCAL_MANIFEST_PATH, { cache: 'no-store' });
        const content = await response.text();
        localVersion = parseVersionFromFile(content);
        return localVersion;
    } catch (error) {
        console.error('[WBG-Updater] Could not get local version.', error);
        return '0.0.0';
    }
}

/**
 * Checks for updates and displays a notification if a new version is available.
 */
export async function checkForUpdates() {
    try {
        const [local, remoteManifest] = await Promise.all([
            getLocalVersion(),
            fetchRawFileContentFromGitHub(MANIFEST_PATH),
        ]);

        remoteVersion = parseVersionFromFile(remoteManifest);

        console.log(`[WBG-Updater] Local version: ${local}, Remote version: ${remoteVersion}`);

        if (compareSemVer(remoteVersion, local) > 0) {
            console.log('[WBG-Updater] New version available!');
            // You can implement a UI notification here, e.g., showing a dot on the settings icon.
            // For now, let's just log it and prepare the changelog.
            try {
                changelogContent = await fetchRawFileContentFromGitHub(CHANGELOG_PATH);
            } catch {
                changelogContent = '无法加载更新日志。';
            }
            return true; // Indicates an update is available
        }
        return false; // No update
    } catch (error) {
        console.error('[WBG-Updater] Update check failed:', error);
        return false;
    }
}

/**
 * Triggers the SillyTavern backend to update the extension.
 */
async function triggerUpdate() {
    toastr.info('正在开始更新，请稍候...');
    try {
        const response = await fetch('/api/extensions/update', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extensionName: 'world-book-generator',
                global: false, // Assuming it's a local extension
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || response.statusText);
        }

        const data = await response.json();
        if (data.isUpToDate) {
            toastr.warning('插件已经是最新版本。');
        } else {
            toastr.success('更新成功！页面将在3秒后刷新。');
            setTimeout(() => location.reload(), 3000);
        }
    } catch (error) {
        console.error('[WBG-Updater] Update failed:', error);
        toastr.error(`更新失败: ${error.message}`);
    }
}

/**
 * Shows a popup with the changelog and an update button.
 */
export function showUpdatePopup() {
    const popupContent = `
        <div>
            <h3>发现新版本: ${remoteVersion}</h3>
            <hr>
            <h4>更新日志:</h4>
            <div style="max-height: 300px; overflow-y: auto; background: var(--bg1); padding: 10px; border-radius: 5px;">
                ${changelogContent.replace(/\n/g, '<br>')}
            </div>
        </div>
    `;

    callPopup(popupContent, POPUP_TYPE.CONFIRM, {
        okButton: '立即更新',
        cancelButton: '稍后',
        onconfirm: () => {
            triggerUpdate();
        },
    });
}
