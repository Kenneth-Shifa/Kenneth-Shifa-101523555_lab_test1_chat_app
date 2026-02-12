$(document).ready(function() {
    $('#signupForm').on('submit', function(e) {
        e.preventDefault();
        handleSignup();
    });
});

function handleSignup() {
    const username = $('#username').val().trim();
    const password = $('#password').val();
    const errorDiv = $('#errorMessage');
    const successDiv = $('#successMessage');
    
    errorDiv.addClass('d-none');
    successDiv.addClass('d-none');
    
    fetch('/api/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username || '',
            password: password || ''
        })
    })
    .then(async response => {
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Server returned non-JSON response:', text);
            throw new Error('Server error: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            showError(data.error);
        } else {
            successDiv.text('Account created successfully! Redirecting to login...');
            successDiv.removeClass('d-none');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        }
    })
    .catch(error => {
        console.error('Signup error:', error);
        showError('An error occurred. Please try again.');
    });
}

function showError(message) {
    $('#errorMessage').text(message).removeClass('d-none');
}
