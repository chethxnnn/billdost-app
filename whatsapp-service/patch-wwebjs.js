const fs = require('fs');
const path = require('path');

const utilsPath = path.join(__dirname, 'node_modules', 'whatsapp-web.js', 'src', 'util', 'Injected', 'Utils.js');

if (fs.existsSync(utilsPath)) {
    let content = fs.readFileSync(utilsPath, 'utf8');
    if (!content.includes('message.id = newMsgKey;')) {
        content = content.replace(
            `            ...botOptions,
            ...extraOptions,
        };`,
            `            ...botOptions,
            ...extraOptions,
            id: newMsgKey,
        };
        message.id = newMsgKey;`
        );
        fs.writeFileSync(utilsPath, content, 'utf8');
        console.log('[Patch] Applied message.id patch to whatsapp-web.js Utils.js');
    } else {
        console.log('[Patch] whatsapp-web.js Utils.js already patched.');
    }
}
