const fetch = require('node-fetch');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { LRUCache } = require('lru-cache');
const crypto = require('node:crypto');

const dotenv = require('dotenv');
dotenv.config();

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function endpoint_geminiYoutubeSearch(req, res) {
    const query = req.params.query;

    if (!query) {
        res.json({ error: "Query parameter is required." });
        return;
    }

    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash-002' });

    const result = await model.generateContent(`List out the top 5 relevant youtube videos for the query "${query}" in a JSON format. The JSON should contain the title.`);

    console.log(result, result.response);

    res.send(result.response.text());
}

async function endpoint_youtubePlaylistImg(req, res) {
    if (!req.params.playlist) {
        res.json({ error: "Playlist ID is required." });
        return;
    }

    const yres = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${req.params.playlist}&key=${process.env.YOUTUBE_DATA_API_KEY}`);
    const data = await yres.json();

    if (data.items && data.items.length > 0) {
        res.json({
            img: data.items[0].snippet.thumbnails.maxres?.url || data.items[0].snippet.thumbnails.high?.url || data.items[0].snippet.thumbnails.default.url,
            title: data.items[0].snippet.title
        });
    }
    else {
        res.json({ error: "Playlist not found." });
    }
}

async function endpoint_getChannelInfo(req, res) {
    if (!req.params.playlistId) {
        res.json({ error: "Playlist ID is required." });
        return;
    }

    try {
        const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${req.params.playlistId}&key=${process.env.YOUTUBE_DATA_API_KEY}`);
        const playlistData = await playlistRes.json();
        if (!playlistData.items || playlistData.items.length === 0) {
            res.json({ error: "Invalid playlist ID" });
            return;
        }

        const channelId = playlistData.items[0].snippet.channelId;
        const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${process.env.YOUTUBE_DATA_API_KEY}`);
        const channelData = await channelRes.json();
        if (!channelData.items || channelData.items.length === 0) {
            res.json({ error: "Invalid channel ID" });
            return;
        }

        const channelInfo = channelData.items[0].snippet;
        res.json({
            channelId: channelId,
            channelTitle: channelInfo.title,
            channelDescription: channelInfo.description,
            channelThumbnail: channelInfo.thumbnails.default.url,
        });
    } catch (error) {

    }
}

async function endpoint_openWeatherAPI(req, res) {
    const { lat, lon } = req.params;
    const wres = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`);
    const data = await wres.json();
    res.json({
        name: data.name,
        weather: data.weather[0].description,
        temp: data.main.temp,
        humidity: data.main.humidity,
        wind: data.wind.speed
    });
}

class GeminiChatBot {
    static botMap = new LRUCache({
        max: 1000,
        maxAge: 1000 * 60 * 60 * 24, // 1 day
    });

    constructor() {
        this.model = ai.getGenerativeModel({ model: 'gemini-1.5-flash-002' });
        this.chat = this.model.startChat();
    }

    static async endpoint_chatbot(req, res) {
        if (!req.session.botID) {
            req.session.botID = crypto.randomUUID();
        }

        let bot = GeminiChatBot.botMap.get(req.session.botID);
        if (!bot) {
            bot = new GeminiChatBot();
            await bot.chat.sendMessage("You are a helpful assistant answering questions to a farmer requiring help in agriculture in our \"PragatiPath\" farming education site\n" +
                "Also dont answer to any questions unrelated to farming, agiculture and rural life since it is disallowed in this platform. Also push the user towards education and skill building\n" +
                "Here are some useful answers to common questions:\n" +
                "How to avail courses? A: You can avail the courses by clicking the book icon at the left bar of the page and viewing the playlists\n" +
                "How to contact the developers? A: You can contact the developers by clicking the email button at the left bar of the page\n" +
                "How to use the AI tools? A: You can use the AI tools by clicking the AI tools button at the left bar of the page and then pass an image of a sick leaf to the disease finder app, or look at weather patterns or your current location and suggestions" +
                "Who are the developers? A: Code Alpha 4 a team of 4 students Rouvik Maji, Vikash Kumar Gupta, Rajbeer Saha from STCET and Archisman Pal from AOT created this project in the 2025 CODEFLOW Hackathon");

            GeminiChatBot.botMap.set(req.session.botID, bot);
        }

        const query = req.body.query;

        if (!query) {
            res.json({ error: "Query parameter is required." });
            return;
        }

        const msg = await bot.chat.sendMessage(query);
        res.json({ response: msg.response.text() });
    }
}

module.exports = {
    endpoint_openWeatherAPI,
    endpoint_geminiYoutubeSearch,
    endpoint_youtubePlaylistImg,
    endpoint_getChannelInfo,
    GeminiChatBot
};