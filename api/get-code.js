const crypto = require('crypto');

export default async function handler(req, res) {
    const { sponsor, hwid, sig, t } = req.query;
    
    const SIARO = "MIEFKR"; 
    
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    if (!sponsor || !hwid || !sig || !t) {
        return res.status(200).send('SERVER_ERROR_BAD_REQUEST');
    }

    const serverCheckData = sponsor + hwid + SIARO + t;
    const serverSig = crypto.createHash('md5').update(serverCheckData).digest("hex");

    if (serverSig !== sig) {
        return res.status(200).send('SERVER_ERROR_SIGNATURE_MISMATCH');
    }

    if (Date.now() - parseInt(t) > 300000) {
        return res.status(200).send('SERVER_ERROR_LINK_EXPIRED');
    }

    try {
        const authUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/users.json`;
        const authResponse = await fetch(authUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!authResponse.ok) return res.status(200).send('SERVER_ERROR_AUTH_DB');
        
        const authData = await authResponse.json();
        const allowedUsers = authData.allowed_users;

        if (!allowedUsers[sponsor] || allowedUsers[sponsor] !== hwid) {
            return res.status(200).send('SERVER_ERROR_HWID_NOT_REGISTERED');
        }
        const codeUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/main.js`;
        const codeResponse = await fetch(codeUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!codeResponse.ok) return res.status(200).send('SERVER_ERROR_CODE_NOT_FOUND');

        const mainCode = await codeResponse.text();

        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(mainCode);

    } catch (error) {
        return res.status(200).send('SERVER_ERROR_FATAL_EXCEPTION');
    }
}
