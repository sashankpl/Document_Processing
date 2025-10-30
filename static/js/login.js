const poolData = {
    UserPoolId: 'ap-south-1_o9ToKwMah',
    ClientId: '2va4cac443vvv29ukrk8sl0rqg'
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// Tab Switching Logic
const tabs = document.querySelectorAll('.tab');
const forms = document.querySelectorAll('.form-container');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show corresponding form
        forms.forEach(form => {
            form.classList.remove('active');
            if (form.id === `${target}Form`) {
                form.classList.add('active');
            }
        });

        // Clear messages
        document.querySelectorAll('.message').forEach(msg => {
            msg.textContent = '';
            msg.classList.remove('error', 'success');
        });

        // Hide verification container when switching tabs
        document.getElementById('verificationContainer').classList.remove('show');
    });
});

// Login Logic
document.getElementById('loginButton').addEventListener('click', function () {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const messageElement = document.getElementById('loginMessage');

    const authenticationData = {
        Username: username,
        Password: password,
    };

    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
    const userData = {
        Username: username,
        Pool: userPool
    };

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: function (result) {
            messageElement.textContent = 'Login successful!';
            messageElement.classList.add('success');
            messageElement.style.display = 'block';
            setTimeout(() => window.location.href = '/home', 1000);
        },

        onFailure: function (err) {
            messageElement.textContent = err.message || 'An error occurred';
            messageElement.classList.add('error');
            messageElement.style.display = 'block';
        },

        newPasswordRequired: function (userAttributes, requiredAttributes) {
            window.location.href = '/home';
        }
    });
});

let lastUsername = ''; // Store username for verification

// Registration Logic
document.getElementById('registerButton').addEventListener('click', function () {
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const firstName = document.getElementById('registerFirstName').value;
    const lastName = document.getElementById('registerLastName').value;
    const messageElement = document.getElementById('registerMessage');

    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'email',
            Value: email
        }),
        new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'given_name',
            Value: firstName
        }),
        new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'family_name',
            Value: lastName
        })
    ];

    userPool.signUp(username, password, attributeList, null, function (err, result) {
        if (err) {
            messageElement.textContent = err.message || 'An error occurred';
            messageElement.classList.add('error');
            messageElement.style.display = 'block';
            return;
        }

        lastUsername = username; // Store username for verification
        messageElement.textContent = 'Registration successful! Please check your email for verification code.';
        messageElement.classList.add('success');
        messageElement.style.display = 'block';

        // Show verification container
        document.getElementById('verificationContainer').classList.add('show');
    });
});

// Verification Logic
document.getElementById('verifyButton').addEventListener('click', function () {
    const code = document.getElementById('verificationCode').value;
    const messageElement = document.getElementById('registerMessage');

    const userData = {
        Username: lastUsername,
        Pool: userPool
    };

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.confirmRegistration(code, true, function (err, result) {
        if (err) {
            messageElement.textContent = err.message || 'Verification failed';
            messageElement.classList.add('error');
            messageElement.style.display = 'block';
            return;
        }

        messageElement.textContent = 'Verification successful! You can now login.';
        messageElement.classList.add('success');
        messageElement.style.display = 'block';

        // Switch to login tab after successful verification
        setTimeout(() => {
            document.querySelector('[data-tab="login"]').click();
        }, 2000);
    });
});

// Resend Verification Code
document.getElementById('resendCode').addEventListener('click', function () {
    const messageElement = document.getElementById('registerMessage');

    const userData = {
        Username: lastUsername,
        Pool: userPool
    };

    const cognitoUser = new AmazonCognitoIdentity.CognitoUserAttribute(userData);

    cognitoUser.resendConfirmationCode(function (err, result) {
        if (err) {
            messageElement.textContent = err.message || 'Failed to resend code';
            messageElement.classList.add('error');
            messageElement.style.display = 'block';
            return;
        }

        messageElement.textContent = 'Verification code has been resent to your email';
        messageElement.classList.add('success');
        messageElement.style.display = 'block';
    });
});