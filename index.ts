import TelegramBot = require('node-telegram-bot-api');
import { Message} from 'node-telegram-bot-api';
import pg = require('pg');
import { Client } from 'pg';
import config from './config';
import { Downloader } from "nodejs-file-downloader";

interface Feedback {
    id: number | null
    text: string;
    date: Date;
    messageId: Number
}

interface FeedbackDAO {
    create(feedback: Feedback): Promise<number>;
    update(id: number, feedback: Feedback): Promise<void>;
    delete(id: number): Promise<void>;
    findById(id: number): Promise<Feedback | null>;
    findByMessageId(messageId: number): Promise<Feedback | null>
    findAll(): Promise<Feedback[]>;
}

class FeedbackPostgresDao implements FeedbackDAO {

    private client: Client

    constructor(client: Client) {
        this.client = client;
    }
    async findByMessageId(messageId: number): Promise<Feedback | null> {
        let query = 'select * from feedback where message_id = $1';
        let postgresResult = await this.client.query(query, [messageId]);
        let rows = postgresResult.rows;
        if (rows.length === 0) {
            return null
        } else {
            return rows[0];
        }
    }
    async create(feedback: Feedback): Promise<number> {
        let query = 'INSERT INTO feedback (text, date, message_id) VALUES ($1, $2, $3) returning id';
        let postgresResult = await this.client.query(query, [feedback.text, feedback.date, feedback.messageId]);
        let rows = postgresResult.rows;
        if (rows.length === 0) {
            throw new Error("Couldn't create feedback. Unknown error.");
        };
        return rows[0].id;
    }
    update(id: number, feedback: Feedback): Promise<void> {
        throw new Error('Method not implemented.');
    }
    delete(id: number): Promise<void> {
        throw new Error('Method not implemented.');
    }
    findById(id: number): Promise<Feedback | null> {
        throw new Error('Method not implemented.');
    }
    findAll(): Promise<Feedback[]> {
        throw new Error('Method not implemented.');
    }
}

interface File {
    id: number ; 
    path: string; 
    feedbackId: number; 
    name: string;
}

interface FileDAO {
    create(file: File): Promise<Number>;
    update(id: number, file: File): Promise<File>;
    delete(id: number): Promise<void>;
    findById(id: number): Promise<Feedback | null>;
    findAllByFeedbackId(feedbackId: number): Promise<File[]>;

}

class FilePostgresDAO implements FileDAO {
    private client: Client

    constructor(client: Client) {
        this.client = client;
    }

    async create(file: File): Promise<number> {
        let query = 'INSERT INTO file (path, feedback_id, name) VALUES ($1, $2, $3) returning id';
        let postgresResult = await this.client.query(query, [file.path, file.feedbackId, file.name]);
        let rows = postgresResult.rows;
        if (rows.length === 0) {
            throw new Error("Couldn't create file. Unknown error.");
        };
        return rows[0].id;
    }
    update(id: number, file: File): Promise<File> {
        throw new Error('Method not implemented.');
    }
    delete(id: number): Promise<void> {
        throw new Error('Method not implemented.');
    }
    findById(id: number): Promise<Feedback | null> {
        throw new Error('Method not implemented.');
    }
    findAllByFeedbackId(feedbackId: number): Promise<File[]> {
        throw new Error('Method not implemented.');
    }

}

const client: Client = new Client(config.database_settings);
client.connect()
    .then(() => {
        console.log("connected");
    })
    .catch((err) => {
        console.log(err);
    });

const feedbackDao: FeedbackDAO = new FeedbackPostgresDao(client);
const fileDAO: FileDAO = new FilePostgresDAO(client);
const bot = new TelegramBot(config.telegram_token, { polling: true });

bot.on('photo', async (msg: Message) => {
    const chatId: number = msg.chat.id;
    const fileId: string = msg.photo.pop().file_id;;
    const fileInfo: TelegramBot.File = await bot.getFile(fileId);
    const url = "https://api.telegram.org/file/bot" + config.telegram_token + "/" + fileInfo.file_path;
        const downloader = new Downloader({
            url: url, //If the file name already exists, a new file with the name 200MB1.zip is created.
            directory: "./downloads", //This folder will be created, if it doesn't exist.   
          });
    if (msg.caption) {
        try {
            const {filePath,downloadStatus} = await downloader.download(); //Downloader.download() resolves with some useful properties.
            const feedbackId: number = await feedbackDao.create({
                id: null,
                text: msg.caption,
                date: new Date(),
                messageId: msg.message_id
            });
            fileDAO.create({
                id: null,
                path: filePath,
                feedbackId: feedbackId,
                name: null
            });
            console.log("All done");
          } catch (error) {
            console.log("Download failed", error);
          }
        const responeMsg: string = "Спасибо за обратную связь!";
        bot.sendMessage(chatId, responeMsg);
    } else {
        const responeMsg: string = "Ошибка загрузки изображения. Нельзя загружать изображения без подписи!";
        bot.sendMessage(msg.chat.id, responeMsg);
    }
})

bot.on('document', async (msg: Message) => {
    const chatId: number = msg.chat.id;
    const fileId: string = msg.document.file_id
    const fileName: string = msg.document.file_name;
    const fileSize: number = msg.document.file_size;
    if (fileSize > 20971520) {
        bot.sendMessage(chatId, "Бот не поддерживает файлы больше 20 мб");
        return;
    }
    const fileInfo: TelegramBot.File = await bot.getFile(fileId);
    if (msg.caption) {
        const url = "https://api.telegram.org/file/bot" + config.telegram_token + "/" + fileInfo.file_path;
        const downloader = new Downloader({
            url: url, //If the file name already exists, a new file with the name 200MB1.zip is created.
            directory: "./downloads", //This folder will be created, if it doesn't exist.   
          });
          try {
            const {filePath,downloadStatus} = await downloader.download(); //Downloader.download() resolves with some useful properties.
            const feedbackId: number = await feedbackDao.create({
                id: null,
                text: msg.caption,
                date: new Date(),
                messageId: msg.message_id
            });
            fileDAO.create({
                id: null,
                path: filePath,
                feedbackId: feedbackId,
                name: fileName
            });
            console.log("All done");
          } catch (error) {
            console.log("Download failed", error);
          }
        const responeMsg: string = "Спасибо за обратную связь!";
        bot.sendMessage(chatId, responeMsg);
    } else {
        const responeMsg: string = "Файл " + fileName + " не загружен. Нельзя загружать файлы без подписи.";
        bot.sendMessage(chatId, responeMsg);
    }
});

bot.onText(/^(?!\/).*/, (msg: Message, match: string[]) => {
    if ((match.length == 1)) {
        feedbackDao.create({
            'id': null,
            'text': msg.text,
            'date': new Date(),
            'messageId': msg.message_id
        })
        const responeMsg: string = "Спасибо за обратную связь!";
        bot.sendMessage(msg.chat.id, responeMsg);
    }
});

bot.onText(/\/start/, (msg: Message, match: string[]) => {
    if (match.length == 1) {
        const responeMsg: string =
            "Добрый день! Я - бот обратной связи АйТи План.\n" +
            "Вы можете доверить мне свои предложения, замечания и впечатления от работы в компании.\n"
        "Я гарантирую конфиденциальность и надёжность: ваши слова будут переданы руководству без искажений и в кратчайшие сроки.\n";
        bot.sendMessage(msg.chat.id, responeMsg);
    }
});


