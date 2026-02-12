$(document).ready(function() {
    const savedUser = localStorage.getItem('chatUser');
    if (savedUser) {
        window.location.href = 'rooms.html';
        return;
    }
    
    $('#loginForm').on('submit', function(e) {
        e.preventDefault();
        handleLogin();
    });
});

function handleLogin() {
    const username = $('#username').val().trim();
    const password = $('#password').val();
    const errorDiv = $('#errorMessage');
    
    errorDiv.addClass('d-none');
    
    if (!username || !password) {
        showError('Username and password are required');
        return;
    }
    
    fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username,
            password: password
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showError(data.error);
        } else {
            const userData = {
                username: data.username,
                userId: data.userId,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('chatUser', JSON.stringify(userData));
            window.location.href = 'rooms.html';
        }
    })
    .catch(error => {
        console.error('Login error:', error);
        showError('An error occurred. Please try again.');
    });
}

function showError(message) {
    $('#errorMessage').text(message).removeClass('d-none');
}
