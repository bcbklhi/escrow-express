# Escrow Express Telegram Bot

This is a fully-featured Telegram escrow bot with:
- Captcha 🛡
- Deal form step-by-step 📄
- Admin claim system
- Payment screenshot + admin approval
- Release / Refund buttons (anti-scam)
- Analytics, logs, owner/admin commands

## Deploy on Zeabur

1. Fork or use this repo.
2. Go to [Zeabur.com](https://zeabur.com) and login.
3. Click **New Project** → Link to this GitHub repo.
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `node index.js`
6. Add 4 Environment Variables in Zeabur:
   - `BOT_TOKEN`, `OWNER_ID`, `GROUP_ID`, `LOG_CHANNEL_ID`
7. Click **Deploy**. Your bot will go live in minutes!

---

## How to Use

- `/start` → Captcha check → "INR Deal" button
- Fill the deal form
- Buyer/seller confirm in group
- Admin claims and monitors
- Buyer uploads screenshot + code
- Admin approves or rejects
- Then release or refund using `/release DEALID` or `/refund DEALID`
