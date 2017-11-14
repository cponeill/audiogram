const audio = require('./audio');
const video = require('./video');
const preview = require('./preview');
const transcript = require('./transcript');
const logger = require('./slack');

function setClass(test) {
    const utils = require('./utils');
    utils.setClass(test);
}

const MEDIA = {};
const BLOBS = {};

function _get(type) {
    return type ? MEDIA[type] : MEDIA;
}

function _blobs(type) {
    return type ? BLOBS[type] : BLOBS;
}

function loadFromURL(type, url, cb) {
    var blob = null;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.onload = function() {
        blobs[type] = xhr.response;
        if (type == 'audio') {
            updateAudioFile(xhr.response, cb);
        } else {
            updateImage(null, type, xhr.response, cb);
        }
    };
    xhr.send();
}

async function update(blob, cb) {
    if (!(blob instanceof Blob)) blob = false;

    jQuery('#row-audio').removeClass('error');
    audio.pause();
    video.kill();
    var audioFile = blob || jQuery('#input-audio').get(0).files[0];

    // Skip if empty
    if (!audioFile) {
        jQuery('#minimap').removeClass('hidden');
        preview.file(null);
        setClass(null);
        return true;
    }

    var filename = blob
        ? 'blob'
        : jQuery('#input-audio')
              .val()
              .split('\\')
              .pop();
    var size = audioFile.size / 1000000;

    if (size >= 150) {
        setClass(
            'error',
            'Maximum upload size is 150MB. (Audio: ' +
                filename +
                ' - ' +
                Math.round(size * 10) / 10 +
                'MB)'
        );
        return;
    }

    transcript.generate(audioFile);

    jQuery('#splash').addClass('hidden');
    jQuery('#subtitles, #transcript').removeClass('hidden');
    jQuery('#loading-message').text('Analyzing...');
    setClass('loading');

    const err = await preview.loadAudio(audioFile);

    jQuery('#minimap, #submit').removeClass('hidden');
    if (err) {
        jQuery('#row-audio').addClass('error');
        setClass('error', 'Error decoding audio file (' + filename + ')');
        if (cb) cb(err);
        jQuery('#minimap, #submit').addClass('hidden');
    } else {
        setClass(null);
        await upload('audio', audioFile);
        if (!blob)
            logger.info(
                USER.name + ' uploaded a local audio file: ' + filename
            );
        if (cb) cb(null);
    }

    if (!blob && audioFile.type.startsWith('video')) {
        jQuery('#videoload a').attr('data-used', false);
        jQuery('#videoload').removeClass('hidden');
    }
}

async function upload(type, blob) {  // Reset
    delete(MEDIA[type]);
    delete(BLOBS[type]);
    if (!blob) return;
    MEDIA[type] = {name: blob.name || "blob", size: blob.size};
    BLOBS[type] = blob;
    // Prepare payload
    var formData = new FormData();
    formData.append('type', type);
    formData.append('file', blob);
    // AJAX submit
    jQuery.ajax({
        async: true,
        url: '/upload/',
        type: 'POST',
        data: formData,
        contentType: false,
        dataType: 'json',
        cache: false,
        processData: false,
        success: function(data) {
            if (MEDIA[data.type] && data.name == MEDIA[data.type].name && data.size == MEDIA[data.type].size) {
                MEDIA[data.type] = data;
            }
        },
        error: error
    });
}

module.exports = {
    loadFromURL,
    update,
    upload,
    get: _get,
    blobs: _blobs
};
