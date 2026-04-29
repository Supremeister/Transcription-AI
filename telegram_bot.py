"""
Telegram бот для транскрибации аудио и видео.
Отправь голосовое или аудиофайл — получишь транскрипт + AI анализ.

Запуск: python telegram_bot.py
Требует: pip install python-telegram-bot aiohttp
"""

import os
import asyncio
import logging
import tempfile
import aiohttp
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Конфиг
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
BACKEND = os.getenv('TRANSCRIBER_BACKEND', 'http://localhost:3000')
DEFAULT_LANGUAGE = 'ru'

if not BOT_TOKEN:
    raise RuntimeError('Укажи TELEGRAM_BOT_TOKEN в .env или переменных окружения')


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 Привет! Я транскрибирую аудио и видео.\n\n"
        "Просто отправь:\n"
        "• 🎤 Голосовое сообщение\n"
        "• 🎵 Аудиофайл (MP3, M4A, WAV и др.)\n"
        "• 🎥 Видеофайл (MP4, MOV и др.)\n\n"
        "Получишь текст + AI анализ разговора."
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "ℹ️ Команды:\n"
        "/start — приветствие\n"
        "/help — эта справка\n\n"
        "Для смены языка добавь в подпись к файлу: en (для английского)\n"
        "По умолчанию: русский"
    )


async def handle_media(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = update.message

    # Определяем тип и получаем file_id
    if msg.voice:
        tg_file = await msg.voice.get_file()
        filename = f"voice_{msg.message_id}.ogg"
    elif msg.audio:
        tg_file = await msg.audio.get_file()
        filename = msg.audio.file_name or f"audio_{msg.message_id}.mp3"
    elif msg.video:
        tg_file = await msg.video.get_file()
        filename = msg.video.file_name or f"video_{msg.message_id}.mp4"
    elif msg.document:
        doc = msg.document
        ext = (doc.file_name or '').split('.')[-1].lower()
        allowed = {'mp3', 'wav', 'ogg', 'm4a', 'aac', 'mp4', 'mov', 'mkv', 'avi', 'webm'}
        if ext not in allowed:
            await msg.reply_text("❌ Формат не поддерживается. Отправь аудио или видеофайл.")
            return
        tg_file = await doc.get_file()
        filename = doc.file_name or f"file_{msg.message_id}.{ext}"
    else:
        return

    # Язык из подписи
    caption = (msg.caption or '').strip().lower()
    language = 'en' if 'en' in caption else DEFAULT_LANGUAGE

    status_msg = await msg.reply_text("⏳ Транскрибируем...")

    try:
        # Скачиваем файл во временную папку
        with tempfile.NamedTemporaryFile(suffix=f"_{filename}", delete=False) as tmp:
            tmp_path = tmp.name

        await tg_file.download_to_drive(tmp_path)

        # Отправляем на бэкенд
        async with aiohttp.ClientSession() as session:
            with open(tmp_path, 'rb') as f:
                form = aiohttp.FormData()
                form.add_field('audio', f, filename=filename)
                form.add_field('language', language)

                async with session.post(
                    f'{BACKEND}/api/transcribe',
                    data=form,
                    timeout=aiohttp.ClientTimeout(total=300)
                ) as resp:
                    result = await resp.json()

        if result.get('success'):
            transcript = result.get('transcript', '').strip()
            if not transcript:
                await status_msg.edit_text("⚠️ Речь не обнаружена. Проверь аудио или смени язык.")
                return

            # Формируем ответ
            reply = f"📝 *Транскрипция:*\n\n{transcript}"

            # AI анализ
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f'{BACKEND}/api/analyze',
                    json={
                        'transcript': transcript,
                        'action': 'full_client',
                    },
                    timeout=aiohttp.ClientTimeout(total=120)
                ) as resp:
                    ai_data = await resp.json()

            if ai_data.get('success') and ai_data.get('result'):
                reply += f"\n\n🤖 *AI Анализ:*\n\n{ai_data['result']}"

            # Telegram ограничение — 4096 символов
            if len(reply) > 4096:
                await status_msg.edit_text(reply[:4090] + "...", parse_mode='Markdown')
            else:
                await status_msg.edit_text(reply, parse_mode='Markdown')
        else:
            error = result.get('error', 'неизвестная ошибка')
            await status_msg.edit_text(f"❌ Ошибка транскрибации: {error}")

    except aiohttp.ClientConnectorError:
        await status_msg.edit_text(
            "❌ Не могу подключиться к транскрибатору.\n"
            "Убедись что приложение запущено на компьютере."
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        await status_msg.edit_text(f"❌ Ошибка: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler('start', cmd_start))
    app.add_handler(CommandHandler('help', cmd_help))
    app.add_handler(MessageHandler(
        filters.VOICE | filters.AUDIO | filters.VIDEO | filters.Document.ALL,
        handle_media
    ))
    logger.info("Бот запущен. Нажми Ctrl+C для остановки.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
