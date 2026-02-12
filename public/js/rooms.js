$(document).ready(function() {
    const savedUser = localStorage.getItem('chatUser');
    if (!savedUser) {
        window.location.href = 'login.html';
        return;
    }
    
    loadRooms();
    $('#logoutBtn').on('click', logout);
});

function loadRooms() {
    fetch('/api/rooms')
        .then(response => response.json())
        .then(data => {
            const roomsList = $('#roomsList');
            roomsList.empty();
            
            if (data.rooms && data.rooms.length > 0) {
                data.rooms.forEach(room => {
                    const roomItem = `
                        <button type="button" class="list-group-item list-group-item-action room-item" data-room="${room}">
                            <div class="d-flex align-items-center">
                                <div class="room-icon me-3">
                                    <span class="badge bg-primary rounded-circle p-3">${room.charAt(0).toUpperCase()}</span>
                                </div>
                                <div>
                                    <h5 class="mb-0">${capitalizeFirst(room)}</h5>
                                    <small class="text-muted">Click to join</small>
                                </div>
                            </div>
                        </button>
                    `;
                    roomsList.append(roomItem);
                });
                
                $('.room-item').on('click', function() {
                    joinRoom($(this).data('room'));
                });
            } else {
                roomsList.html('<p class="text-muted">No rooms available</p>');
            }
        })
        .catch(error => {
            console.error('Error loading rooms:', error);
            $('#errorMessage').text('Failed to load rooms').removeClass('d-none');
        });
}

function joinRoom(room) {
    const savedUser = localStorage.getItem('chatUser');
    if (!savedUser) {
        window.location.href = 'login.html';
        return;
    }
    
    localStorage.setItem('chatRoom', room);
    window.location.href = 'chat.html';
}

function logout() {
    localStorage.removeItem('chatUser');
    localStorage.removeItem('chatRoom');
    window.location.href = 'login.html';
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
