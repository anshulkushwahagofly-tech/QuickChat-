// --- WebRTC Logic for QuickChat ---

let peerConnection;
let localStream;
let remoteStream;
let isVideoCall = true;
let currentCaller = null;

const servers = {
    iceServers: [
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

const videoCallBtn = document.getElementById('video-call-btn');
const audioCallBtn = document.getElementById('audio-call-btn');
const incomingCallModal = document.getElementById('incoming-call-modal');
const activeCallModal = document.getElementById('active-call-modal');
const callerNameDisplay = document.getElementById('caller-name');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

async function initStream(video = true) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: video, audio: true });
        localVideo.srcObject = localStream;
        if(!video) localVideo.style.display = 'none';
        else localVideo.style.display = 'block';
    } catch (err) {
        if (typeof showWhatsAppToast === 'function') {
            showWhatsAppToast("Camera/Mic permission needed: " + err.message, "danger");
        } else {
            console.error("Camera/Mic Error:", err);
        }
        console.error(err);
        return false;
    }
    return true;
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);
    
    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        });
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                to: activeChat || currentCaller,
                candidate: event.candidate
            });
        }
    };
}

function recordCallLog(contactNumber, isOutgoing, isVideo) {
    const num = (typeof myNumber !== 'undefined' && myNumber) ? myNumber : localStorage.getItem('quickchat_session_num');
    if (!num || !contactNumber) return;
    try {
        const key = 'quickchat_call_history_' + num;
        const history = JSON.parse(localStorage.getItem(key) || '[]');
        const timeNow = (typeof formatTime === 'function') ? formatTime(new Date()) : new Date().toLocaleTimeString();
        history.unshift({
            name: '+91 ' + contactNumber,
            type: isOutgoing ? 'outgoing' : 'incoming',
            time: timeNow,
            isVideo: !!isVideo
        });
        if (history.length > 50) history.pop();
        localStorage.setItem(key, JSON.stringify(history));
    } catch(e) {}
}

async function startCall(video) {
    if (!activeChat) {
        if (typeof showWhatsAppToast === 'function') {
            showWhatsAppToast("Select a chat first to place a call.", "info");
        }
        return;
    }
    isVideoCall = video;
    recordCallLog(activeChat, true, video);
    
    const success = await initStream(video);
    if (!success) return;

    activeCallModal.style.display = 'flex';
    createPeerConnection();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('call-user', {
        to: activeChat,
        offer: offer,
        isVideo: video
    });
}

// Button Listeners
if(videoCallBtn) videoCallBtn.addEventListener('click', () => startCall(true));
if(audioCallBtn) audioCallBtn.addEventListener('click', () => startCall(false));

// Incoming Call
socket.on('call-made', async (data) => {
    currentCaller = data.from;
    isVideoCall = data.isVideo;
    recordCallLog(data.from, false, data.isVideo);
    callerNameDisplay.innerText = data.from;
    incomingCallModal.style.display = 'flex';
    
    acceptCallBtn.onclick = async () => {
        incomingCallModal.style.display = 'none';
        activeCallModal.style.display = 'flex';
        
        const success = await initStream(isVideoCall);
        if(!success) return;
        
        createPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('make-answer', {
            to: data.from,
            answer: answer
        });
    };
    
    rejectCallBtn.onclick = () => {
        incomingCallModal.style.display = 'none';
        socket.emit('reject-call', { to: data.from });
    };
});

socket.on('answer-made', async (data) => {
    if(!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
});

socket.on('call-rejected', () => {
    if (typeof showWhatsAppToast === 'function') {
        showWhatsAppToast("Call Rejected", "danger");
    }
    stopCall();
});

socket.on('call-ended', () => {
    stopCall();
});

socket.on('ice-candidate', async (data) => {
    if(peerConnection) {
        try {
            await peerConnection.addIceCandidate(data.candidate);
        } catch(e) {
            console.error(e);
        }
    }
});

function stopCall() {
    if(peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if(localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    activeCallModal.style.display = 'none';
    incomingCallModal.style.display = 'none';
}

if(endCallBtn) endCallBtn.addEventListener('click', () => {
    socket.emit('end-call', { to: activeChat || currentCaller });
    stopCall();
});
