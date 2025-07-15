require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

const OWNER_ID = process.env.OWNER_ID;
const GROUP_ID = process.env.GROUP_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const deals = new Map();
const admins = new Set();
const captchas = new Map();
let dealCount = 0;

// 🔐 Captcha Middleware
bot.use(async (ctx, next) => {
  if (ctx.chat.type !== "private") return next();

  if (!captchas.has(ctx.from.id)) {
    const code = Math.floor(1000 + Math.random() * 9000);
    captchas.set(ctx.from.id, code);
    await ctx.reply(`🔐 Captcha Verification: Type *${code}* to continue.`, { parse_mode: "Markdown" });

    bot.once("text", async (res) => {
      if (res.text == code.toString()) {
        captchas.delete(ctx.from.id);
        await res.reply("✅ Captcha verified!");
        return next();
      } else {
        await res.reply("❌ Incorrect captcha. Try again.");
        captchas.delete(ctx.from.id);
      }
    });
  } else {
    return next();
  }
});

// /start command
bot.start(async (ctx) => {
  await ctx.reply(
    "👋 Welcome to *Escrow Express*\nClick below to begin your deal.",
    Markup.keyboard([["💰 INR Deal"]]).resize(),
    { parse_mode: "Markdown" }
  );
});

// Deal flow
bot.hears("💰 INR Deal", async (ctx) => {
  const deal = { step: 0, user: ctx.from.id, data: {} };
  deals.set(ctx.from.id, deal);
  await ctx.reply("📝 Deal of:");
});

bot.on("text", async (ctx) => {
  const deal = deals.get(ctx.from.id);
  if (!deal || deal.user !== ctx.from.id) return;

  const answers = [
    "📝 Total Amount:",
    "⏰ Time to complete deal:",
    "💸 When releasing payment:",
    "🏦 Payment from which bank (compulsory):",
    "👤 Seller Username:",
    "👥 Buyer Username:",
  ];

  const fields = ["dealOf", "amount", "time", "releaseWhen", "bank", "seller", "buyer"];
  deal.data[fields[deal.step]] = ctx.message.text;
  deal.step++;

  if (deal.step < answers.length) {
    await ctx.reply(answers[deal.step]);
  } else {
    dealCount++;
    const id = "DEAL" + dealCount;
    deal.id = id;
    deal.status = "pending";
    deals.set(id, deal);
    deals.delete(ctx.from.id);

    const msg = `📄 *New Deal Created!*\n\n🆔 Deal ID: ${id}\n📌 Deal: ${deal.data.dealOf}\n💰 Amount: ₹${deal.data.amount}\n⏰ Time: ${deal.data.time}\n💸 Release: ${deal.data.releaseWhen}\n🏦 Bank: ${deal.data.bank}\n👤 Seller: @${deal.data.seller}\n👥 Buyer: @${deal.data.buyer}`;

    await bot.telegram.sendMessage(GROUP_ID, msg, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Buyer Agree", callback_data: `agree_buyer_${id}` },
            { text: "✅ Seller Agree", callback_data: `agree_seller_${id}` },
          ],
        ],
      },
    });

    await bot.telegram.sendMessage(LOG_CHANNEL_ID, `🆕 New deal logged: ${id}`);
  }
});

// Handle agree buttons
bot.on("callback_query", async (ctx) => {
  const [action, role, id] = ctx.callbackQuery.data.split("_");
  const deal = deals.get(id);
  if (!deal) return ctx.answerCbQuery("❌ Invalid deal.");

  if (!deal.agreed) deal.agreed = {};
  if (deal.agreed[role]) return ctx.answerCbQuery("❌ Already agreed.");
  deal.agreed[role] = ctx.from.username;

  await ctx.answerCbQuery(`✅ ${role} confirmed`);
  await ctx.editMessageReplyMarkup({
    inline_keyboard: [
      [
        {
          text: "✅ Buyer Agree" + (deal.agreed.buyer ? " ✅" : ""),
          callback_data: `agree_buyer_${id}`,
        },
        {
          text: "✅ Seller Agree" + (deal.agreed.seller ? " ✅" : ""),
          callback_data: `agree_seller_${id}`,
        },
      ],
    ],
  });

  if (deal.agreed.buyer && deal.agreed.seller) {
    await bot.telegram.sendMessage(GROUP_ID, `🧾 Both parties confirmed for deal ${id}\nWaiting for admin claim...`);
    await bot.telegram.sendMessage(OWNER_ID, `📢 *New Deal Alert*\nID: ${id}\nClick below to claim:`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🛡️ Claim Deal", callback_data: `claim_${id}` }]],
      },
    });
  }
});

// Claim deal (only owner for now)
bot.action(/claim_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const deal = deals.get(id);
  if (!deal) return ctx.answerCbQuery("❌ Invalid.");

  deal.claimedBy = ctx.from.username;
  deal.status = "claimed";

  await ctx.editMessageText(`🛡️ Deal ${id} claimed by @${ctx.from.username}`);
  await bot.telegram.sendMessage(GROUP_ID, `🛡️ Deal ${id} is now under admin monitoring by @${ctx.from.username}`);

  // Send payment instruction to buyer
  await bot.telegram.sendMessage(
    deal.data.buyer.startsWith("@") ? deal.data.buyer : "@" + deal.data.buyer,
    `📤 Please send payment to UPI ID and upload screenshot.\nUse code: *${id}* in caption.`,
    { parse_mode: "Markdown" }
  );
});

// Admin-only commands

bot.command("broadcast", async (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) return;
  await ctx.reply("📢 Send your broadcast message:");
  bot.once("text", async (ctx2) => {
    for (const [, deal] of deals) {
      try {
        await bot.telegram.sendMessage(deal.user, `📢 Broadcast:\n${ctx2.message.text}`);
      } catch {}
    }
    await ctx2.reply("✅ Sent.");
  });
});

bot.command("analytics", async (ctx) => {
  if (ctx.from.id.toString() !== OWNER_ID) return;
  let total = dealCount;
  let pending = [...deals.values()].filter(d => d.status === "pending").length;
  let claimed = [...deals.values()].filter(d => d.status === "claimed").length;
  await ctx.reply(`📊 Total Deals: ${total}\n🕓 Pending: ${pending}\n🛡️ Claimed: ${claimed}`);
});

// Launch
bot.launch();
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
