let socket;
let currentUser = null;
let currentRoom = null;
let typingTimeout;
let privateTypingTimeout;

$(document).ready(function() {
    const savedUser = localStorage.getItem('chatUser');
    const savedRoom = localStorage.getItem('chatRoom');
    
    if (!savedUser || !savedRoom) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = JSON.parse(savedUser);
    currentRoom = savedRoom;
    
    initializeChat();
    
    $('#messageForm').on('submit', function(e) {
        e.preventDefault();
        sendMessage();
    });
    
    $('#messageInput').on('input', handleTyping);
    $('#messageInput').on('keypress', function(e) {
        if (e.which === 13 && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    $('#sendPrivateBtn').on('click', sendPrivateMessage);
    $('#privateMessageInput').on('input', handlePrivateTyping);
    $('#privateMessageInput').on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            sendPrivateMessage();
        }
    });
    
    $('#leaveRoomBtn').on('click', leaveRoom);
    $('#logoutBtn').on('click', logout);
});

function initializeChat() {
    socket = io(window.location.origin);
    
    socket.emit('joinRoom', {
        username: currentUser.username,
        room: currentRoom
    });
    
    socket.on('message', displayMessage);
    socket.on('privateMessage', displayPrivateMessage);
    socket.on('roomUsers', updateUserList);
    socket.on('typing', function(data) {
        if (data.username !== currentUser.username) {
            showTypingIndicator(data.username);
        }
    });
    socket.on('stopTyping', hideTypingIndicator);
    socket.on('privateTyping', function(data) {
        if (data.username !== currentUser.username) {
            showPrivateTypingIndicator(data.username);
        }
    });
    socket.on('stopPrivateTyping', hidePrivateTypingIndicator);
    socket.on('error', function(data) {
        showError(data.message || 'An error occurred');
    });
    socket.on('connect_error', function(error) {
        console.error('Connection error:', error);
        showError('Failed to connect to server. Please check if the server is running.');
    });
    
    $('#roomName').text(capitalizeFirst(currentRoom) + ' Room');
    $('#roomIcon').text(currentRoom.charAt(0).toUpperCase());
    $('#currentUsername').text(currentUser.username);
    
    loadRecentMessages();
    loadUsers();
}

function loadRecentMessages() {
    fetch(`/api/rooms/${currentRoom}/messages`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to load messages');
            return response.json();
        })
        .then(messages => {
            if (Array.isArray(messages)) {
                messages.forEach(message => {
                    displayMessage({
                        username: message.username,
                        text: message.text,
                        timestamp: message.timestamp,
                        type: 'user'
                    });
                });
            }
        })
        .catch(error => {
            console.error('Error loading messages:', error);
        });
}

function loadUsers() {
    fetch(`/api/rooms/${currentRoom}/users`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to load users');
            return response.json();
        })
        .then(users => {
            if (Array.isArray(users)) {
                updateUserList(users);
            }
        })
        .catch(error => {
            console.error('Error loading users:', error);
        });
}

function sendMessage() {
    if (!socket || !socket.connected) {
        showError('Not connected to server');
        return;
    }
    
    const text = $('#messageInput').val().trim();
    if (!text) return;
    
    socket.emit('sendMessage', {
        username: currentUser.username,
        room: currentRoom,
        text: text
    });
    
    $('#messageInput').val('');
    stopTyping();
}

function sendPrivateMessage() {
    if (!socket || !socket.connected) {
        showError('Not connected to server');
        return;
    }
    
    const recipient = $('#privateRecipient').val();
    const text = $('#privateMessageInput').val().trim();
    
    if (!recipient) {
        showError('Please select a recipient');
        return;
    }
    
    if (!text) {
        showError('Please enter a message');
        return;
    }
    
    if (recipient === currentUser.username) {
        showError('Cannot send private message to yourself');
        return;
    }
    
    stopPrivateTyping();
    
    socket.emit('sendPrivateMessage', {
        username: currentUser.username,
        recipient: recipient,
        text: text
    });
    
    $('#privateMessageInput').val('');
}

function displayMessage(data) {
    const messagesList = $('#messagesList');
    const isOwnMessage = data.username === currentUser.username;
    const isSystemMessage = data.type === 'system';
    
    let messageHtml = '';
    
    if (isSystemMessage) {
        messageHtml = `
            <div class="message message-system">
                <div class="message-bubble">${escapeHtml(data.text)}</div>
            </div>
        `;
    } else {
        const messageClass = isOwnMessage ? 'message-own' : 'message-other';
        const time = formatTime(data.timestamp);
        
        messageHtml = `
            <div class="message ${messageClass}">
                ${!isOwnMessage ? `<div class="message-username">${escapeHtml(data.username)}</div>` : ''}
                <div class="message-bubble">${escapeHtml(data.text)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    }
    
    messagesList.append(messageHtml);
    scrollToBottom();
}

function displayPrivateMessage(data) {
    const messagesList = $('#messagesList');
    const isSent = data.sent === true;
    const otherUser = isSent ? data.recipient : data.username;
    const time = formatTime(data.timestamp);
    
    const messageHtml = `
        <div class="message message-private">
            <div class="message-username">
                <strong>Private:</strong> ${escapeHtml(otherUser)}
            </div>
            <div class="message-bubble private-bubble">${escapeHtml(data.text)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messagesList.append(messageHtml);
    scrollToBottom();
}

function updateUserList(users) {
    const usersList = $('#usersList');
    
    usersList.empty();
    
    // Separate current user from others
    const currentUserObj = users.find(u => u.username === currentUser.username);
    const otherUsers = users
        .filter(u => u.username !== currentUser.username)
        .slice(0, 4); // Limit to 4 other users
    
    // Combine: current user first, then 4 other users
    const displayUsers = currentUserObj 
        ? [currentUserObj, ...otherUsers]
        : otherUsers;
    
    $('#userCount').text(displayUsers.length + ' ' + (displayUsers.length === 1 ? 'user' : 'users'));
    
    displayUsers.forEach(user => {
        const isCurrentUser = user.username === currentUser.username;
        const userClass = isCurrentUser ? 'current-user' : '';
        const avatarBg = isCurrentUser ? 'var(--color-blue-gray)' : '#ccc';
        
        const userHtml = `
            <div class="user-item ${userClass}">
                <div class="d-flex align-items-center">
                    <div class="user-avatar" style="background-color: ${avatarBg}">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center">
                            <strong>${escapeHtml(user.username)}</strong>
                            ${isCurrentUser ? '<span class="ms-2 text-muted small">(You)</span>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        usersList.append(userHtml);
    });
}

function handleTyping() {
    if (!socket || !socket.connected) return;
    
    const text = $('#messageInput').val().trim();
    if (text.length > 0) {
        socket.emit('typing', {
            username: currentUser.username,
            room: currentRoom
        });
        
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(stopTyping, 3000);
    } else {
        stopTyping();
    }
}

function stopTyping() {
    if (socket && socket.connected) {
        socket.emit('stopTyping', { room: currentRoom });
    }
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
}

function showTypingIndicator(username) {
    if (username !== currentUser.username) {
        $('#typingIndicator').removeClass('d-none');
    }
}

function hideTypingIndicator() {
    $('#typingIndicator').addClass('d-none');
}

function handlePrivateTyping() {
    if (!socket || !socket.connected) return;
    
    const recipient = $('#privateRecipient').val();
    if (!recipient) return;
    
    const text = $('#privateMessageInput').val().trim();
    if (text.length > 0) {
        socket.emit('privateTyping', {
            username: currentUser.username,
            recipient: recipient
        });
        
        if (privateTypingTimeout) clearTimeout(privateTypingTimeout);
        privateTypingTimeout = setTimeout(stopPrivateTyping, 3000);
    } else {
        stopPrivateTyping();
    }
}

function stopPrivateTyping() {
    const recipient = $('#privateRecipient').val();
    if (socket && socket.connected && recipient) {
        socket.emit('stopPrivateTyping', { recipient: recipient });
    }
    if (privateTypingTimeout) {
        clearTimeout(privateTypingTimeout);
        privateTypingTimeout = null;
    }
}

function showPrivateTypingIndicator(username) {
    const typingHtml = `
        <div class="message message-system">
            <div class="message-bubble">
                <em>${escapeHtml(username)} is typing a private message...</em>
            </div>
        </div>
    `;
    $('#messagesList .private-typing-indicator').remove();
    $('#messagesList').append(`<div class="private-typing-indicator">${typingHtml}</div>`);
    scrollToBottom();
}

function hidePrivateTypingIndicator() {
    $('#messagesList .private-typing-indicator').remove();
}

function leaveRoom() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
    
    localStorage.removeItem('chatRoom');
    window.location.href = 'rooms.html';
}

function logout() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
    
    localStorage.removeItem('chatUser');
    localStorage.removeItem('chatRoom');
    window.location.href = 'login.html';
}

function scrollToBottom() {
    const container = $('#messagesContainer');
    container.scrollTop(container[0].scrollHeight);
}

function showError(message) {
    alert(message);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
