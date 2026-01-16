#!/usr/bin/env node
/**
 * Update genRTL.exe icon
 */

const path = require('path');
const rcedit = require('./vscode/node_modules/rcedit');
const { promisify } = require('util');
const rceditAsync = promisify(rcedit);

async function main() {
    const exePath = path.join(__dirname, 'VSCode-win32-x64', 'genRTL.exe');
    const iconPath = path.join(__dirname, 'vscode', 'resources', 'win32', 'code.ico');

    console.log('Updating icon for:', exePath);
    console.log('Using icon:', iconPath);

    try {
        await rceditAsync(exePath, {
            icon: iconPath
        });
        console.log('✅ Icon updated successfully!');
        console.log('Please restart genRTL to see the new icon.');
        console.log('Note: Windows may cache icons. If you don\'t see the change:');
        console.log('  1. Delete IconCache.db in %localappdata%');
        console.log('  2. Restart Windows Explorer');
    } catch (err) {
        console.error('❌ Error updating icon:', err);
        process.exit(1);
    }
}

main();
