const axios = require('axios');
const fs = require('fs');
const ytdl = require('ytdl-core');
const uuid = require('uuid');
const mongoose = require('mongoose');
const Summary = require('../models/Summary');

const baseUrl = 'https://api.assemblyai.com/v2';
const uploadUrl = 'https://api.assemblyai.com/v2/upload';
const transcriptUrl = 'https://api.assemblyai.com/v2/transcript';

const mongoDataBase = 'mongodb://localhost:27017/test';

const headers = {
  authorization: 'be7c217f9fa74716bc17362e124f0df7'
};

/**
 * POST /summary
 * Login page.
 */
exports.getSummary = async (req, res) => {

    mongoose.connect(mongoDataBase, { useNewUrlParser: true, useUnifiedTopology: true })
                    .then(() => console.log('MongoDB connected'))
                    .catch((err) => console.log(err));

    Summary
        .findOne({ transactionId: req.body.transactionId })
        .exec((err, result) => {
            if (err) { return next(err); }
            if (!result) {
                    return res.send('Please check it later. The process is ongoing for : ' + req.body.transactionId);
                }
                    res.send(result.summary);
                });

  };

/**
 * POST /postvideo
 * Send a contact form via Nodemailer.
 */
exports.postvideo = async (req, res) => {

    console.log(req.body.message);

    // Step 1
    console.log("start download the audio");

    const transactionId = uuid.v1();

    downloadStream = ytdl(req.body.message, {
        quality: '140',
    }).pipe( fs.createWriteStream('audio.mp4'));


    downloadStream.on('finish', async () => {
            // Step 2
            console.log("Start to upload the audio file");

            const audioData = fs.readFileSync('audio.mp4');

            console.log(audioData)

            const uploadResponse = await axios.post(uploadUrl, audioData, {
            headers
            });

            const audioUrl = uploadResponse.data.upload_url;

            console.log(audioUrl);


            // Step 3
            const data = {
                audio_url: audioUrl,
                summarization: true,
                summary_model: 'informative',
                summary_type: 'bullets'
            }

            const response = await axios.post(transcriptUrl, data, { headers: headers });

            const transcriptId = response.data.id;

            await fs.unlink('audio.mp4', (err) => {
                if (err) throw err;
                console.log('path/file.txt was deleted');
              });

            console.log(transcriptId);

            const pollingEndpoint = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;

            console.log(pollingEndpoint);

            // Step 4: Poll the transcription API until the transcript is ready
            while (true) {
                // Send a GET request to the polling endpoint to retrieve the status of the transcript
                const pollingResponse = await fetch(pollingEndpoint, { headers });
                const transcriptionResult = await pollingResponse.json();

                // If the transcription is complete, return the transcript object
                if (transcriptionResult.status === "completed") {
                console.log(transcriptionResult);

                mongoose.connect(mongoDataBase, { useNewUrlParser: true, useUnifiedTopology: true })
                    .then(() => console.log('MongoDB connected'))
                    .catch((err) => console.log(err));

                const newSummary = new Summary({
                    transactionId: transactionId,
                    summary: transcriptionResult.summary
                });
                      
                await newSummary.save()
                    .then(() => console.log('new Summary created'))
                    .catch((err) => console.log(err));    

                return;
                }
                // If the transcription has failed, throw an error with the error message
                else if (transcriptionResult.status === "error") {
                throw new Error(`Transcription failed: ${transcriptionResult.error}`);
                }
                // If the transcription is still in progress, wait for a few seconds before polling again
                else {
                await new Promise((resolve) => setTimeout(resolve, 3000));
                }

                console.log("keep waiting");
            }

      });
 

    res.send("Proecssing the video. The transcriptId is : " + transactionId);
}