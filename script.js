/**
 * Quiz App JavaScript - Standalone Version
 * Handles all frontend functionality for the quiz application
 * Uses Apps Script URL for backend communication
 */

// Configuration - Replace with your Apps Script URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzIiq3AB8BFtZ9s_PMhs3tnbsQpr2qyv4mwS2SIPg_4fqwXFSZF2KWy0qSCOcuJPB-hEQ/exec';

// Global variables
let questions = [];
let currentQuestionIndex = 0;
let studentAnswers = [];
let studentData = {};
let shuffledQuestions = [];
let sessionQuestions = []; // Questions for current session (no repetition)
let shuffledOptions = [];
let hasAnsweredCurrentQuestion = false; // Track if current question is answered

// Mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);


// DOM elements
const loadingScreen = document.getElementById('loadingScreen');
const registrationForm = document.getElementById('registrationForm');
const quizContainer = document.getElementById('quizContainer');
const resultsScreen = document.getElementById('resultsScreen');
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    hideLoadingScreen();
    showRegistrationForm();
    setupEventListeners();
    setupSecurityFeatures(); // Add security features
});

/**
 * Hide loading screen and show registration form
 */
function hideLoadingScreen() {
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
        registrationForm.classList.remove('hidden');
    }, 1000);
}

/**
 * Show registration form
 */
function showRegistrationForm() {
    registrationForm.classList.remove('hidden');
    quizContainer.classList.add('hidden');
    resultsScreen.classList.add('hidden');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Registration form submission
    document.getElementById('studentForm').addEventListener('submit', handleRegistration);
    
    // Quiz navigation buttons
    document.getElementById('nextBtn').addEventListener('click', nextQuestion);
    
    const finishBtn = document.getElementById('finishBtn');
    if (finishBtn) {
        finishBtn.addEventListener('click', finishQuiz);
        console.log('Finish button event listener added');
    } else {
        console.error('Finish button not found!');
    }
    
    // Results screen buttons
    document.getElementById('completeBtn').addEventListener('click', showThankYouPage);
    document.getElementById('newQuizBtn').addEventListener('click', newStudent);
}

/**
 * Handle student registration
 */
async function handleRegistration(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    studentData = {
        name: formData.get('name'),
        email: formData.get('email'),
        age: formData.get('age') || null,
        grade: formData.get('grade')
    };
    
    // Validate required fields
    if (!studentData.name || !studentData.email || !studentData.grade) {
        showError('يرجى ملء جميع الحقول المطلوبة');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentData.email)) {
        showError('يرجى إدخال بريد إلكتروني صحيح');
        return;
    }
    
    try {
        showLoadingScreen();
        
        // Check if student has already taken the exam
        const hasTakenExam = await checkStudentExamStatus(studentData.email);
        
        if (hasTakenExam) {
            hideLoadingScreen();
            showError('هذا البريد الإلكتروني قد استُخدم من قبل في أداء الامتحان. لا يمكن إعادة الامتحان بنفس البريد الإلكتروني.');
            return;
        }
        
        await loadQuestions();
        startQuiz();
    } catch (error) {
        hideLoadingScreen();
        showError('حدث خطأ في تحميل الأسئلة: ' + error.message);
    }
}

/**
 * Check if student has already taken the exam
 */
async function checkStudentExamStatus(email) {
    try {
        // Check local storage first (as backup)
        const localExamHistory = localStorage.getItem('examHistory');
        if (localExamHistory) {
            const history = JSON.parse(localExamHistory);
            if (history.some(record => record.email === email)) {
                return true; // Student has taken exam locally
            }
        }
        
        // Try POST first, then fallback to GET if needed
        let response;
        try {
            response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'checkStudentStatus',
                    email: email
                })
            });
        } catch (postError) {
            // Fallback to GET method with URL parameters
            const params = new URLSearchParams({
                action: 'checkStudentStatus',
                email: email
            });
            response = await fetch(`${APPS_SCRIPT_URL}?${params}`);
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'فشل في التحقق من حالة الطالب');
        }
        
        return result.hasTakenExam || false;
        
    } catch (error) {
        console.error('Error checking student status:', error);
        // If there's an error checking, allow the student to proceed
        // This prevents blocking students due to technical issues
        return false;
    }
}

/**
 * Update local exam history
 */
function updateLocalExamHistory() {
    try {
        // Get existing history or create new one
        const existingHistory = localStorage.getItem('examHistory');
        let history = existingHistory ? JSON.parse(existingHistory) : [];
        
        // Add current student to history
        const examRecord = {
            email: studentData.email,
            name: studentData.name,
            grade: studentData.grade,
            date: new Date().toISOString(),
            score: studentAnswers.filter(answer => answer && answer.isCorrect).length,
            totalQuestions: studentAnswers.filter(answer => answer && answer.question).length
        };
        
        // Check if student already exists in history
        const existingIndex = history.findIndex(record => record.email === studentData.email);
        if (existingIndex !== -1) {
            // Update existing record
            history[existingIndex] = examRecord;
        } else {
            // Add new record
            history.push(examRecord);
        }
        
        // Save updated history
        localStorage.setItem('examHistory', JSON.stringify(history));
        
        console.log('Local exam history updated:', examRecord);
        
    } catch (error) {
        console.error('Error updating local exam history:', error);
    }
}

/**
 * Mobile-specific fetch function with better error handling
 */
async function mobileFetch(url, options = {}) {
    // For mobile devices, try different approaches
    const mobileOptions = {
        ...options,
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...options.headers
        },
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow'
    };
    
    try {
        console.log('Mobile fetch attempt:', url);
        const response = await fetch(url, mobileOptions);
        console.log('Mobile fetch response status:', response.status);
        return response;
    } catch (error) {
        console.error('Mobile fetch error:', error);
        
        // Try with minimal options as fallback
        try {
            console.log('Trying minimal fetch...');
            const minimalResponse = await fetch(url, {
                method: options.method || 'GET',
                mode: 'cors'
            });
            console.log('Minimal fetch response status:', minimalResponse.status);
            return minimalResponse;
        } catch (minimalError) {
            console.error('Minimal fetch also failed:', minimalError);
            throw error; // Throw original error
        }
    }
}

/**
 * Load questions using XMLHttpRequest for better mobile compatibility
 */
function loadQuestionsXHR() {
    return new Promise((resolve, reject) => {
        console.log('Using XMLHttpRequest for mobile compatibility...');
        
        const xhr = new XMLHttpRequest();
        const url = `${APPS_SCRIPT_URL}?action=getQuestions&t=${Date.now()}`;
        
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
        xhr.setRequestHeader('Cache-Control', 'no-cache');
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        console.log('XHR response:', data);
                        resolve(data);
                    } catch (parseError) {
                        console.error('XHR JSON parse error:', parseError);
                        reject(new Error('Invalid JSON response from server'));
                    }
                } else {
                    console.error('XHR error status:', xhr.status);
                    reject(new Error(`HTTP error! status: ${xhr.status}`));
                }
            }
        };
        
        xhr.onerror = function() {
            console.error('XHR network error');
            reject(new Error('Network error'));
        };
        
        xhr.ontimeout = function() {
            console.error('XHR timeout');
            reject(new Error('Request timeout'));
        };
        
        xhr.timeout = 15000; // 15 second timeout
        xhr.send();
    });
}

/**
 * Load questions from Google Sheets via Apps Script
 */
async function loadQuestions() {
    const maxRetries = 3;
    let lastError;
    
    // For mobile devices, try XMLHttpRequest first
    if (isMobile) {
        console.log('Mobile device detected, trying XMLHttpRequest first...');
        try {
            const data = await loadQuestionsXHR();
            if (data.success && data.questions) {
                questions = data.questions;
                shuffledQuestions = shuffleArray([...questions]);
                console.log(`Successfully loaded ${questions.length} questions using XHR`);
                return;
            }
        } catch (xhrError) {
            console.log('XHR failed, trying fetch...', xhrError.message);
        }
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempting to load questions (attempt ${attempt}/${maxRetries})...`);
            console.log('Apps Script URL:', APPS_SCRIPT_URL);
            
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            // Try with action parameter first
            let response = await mobileFetch(`${APPS_SCRIPT_URL}?action=getQuestions&t=${Date.now()}`, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // If that fails, try without action parameter
            if (!response.ok) {
                console.log('First attempt failed, trying without action parameter...');
                const controller2 = new AbortController();
                const timeoutId2 = setTimeout(() => controller2.abort(), 10000);
                
                response = await mobileFetch(`${APPS_SCRIPT_URL}?t=${Date.now()}`, {
                    method: 'GET',
                    signal: controller2.signal
                });
                
                clearTimeout(timeoutId2);
            }
            
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            
            const responseText = await response.text();
            console.log('Raw response:', responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Response text:', responseText);
                throw new Error('Invalid JSON response from server');
            }
            
            console.log('Parsed data:', data);
            
            if (!data.success) {
                console.error('Load questions failed:', data.error);
                throw new Error(data.error || 'فشل في تحميل الأسئلة');
            }
            
            if (!data.questions || !Array.isArray(data.questions)) {
                throw new Error('Invalid questions data received');
            }
            
            questions = data.questions;
            
            if (questions.length === 0) {
                throw new Error('لا توجد أسئلة متاحة');
            }
            
            // Shuffle questions once - they will be used for the entire session
            // Each student gets the same shuffled order, but questions never repeat
            shuffledQuestions = shuffleArray([...questions]);
            
            console.log(`Successfully loaded ${questions.length} questions, shuffled for session`);
            return; // Success, exit the retry loop
            
        } catch (error) {
            lastError = error;
            console.error(`Error loading questions (attempt ${attempt}/${maxRetries}):`, error);
            
            if (attempt < maxRetries) {
                console.log(`Retrying in ${attempt * 2} seconds...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            }
        }
    }
    
    // If all retries failed, throw the last error
    console.error('All attempts failed, throwing error:', lastError);
    throw lastError;
}

/**
 * Start the quiz
 */
function startQuiz() {
    hideLoadingScreen();
    registrationForm.classList.add('hidden');
    quizContainer.classList.remove('hidden');
    
    // Display student info
    document.getElementById('studentNameDisplay').textContent = studentData.name;
    
    // Reset quiz state
    currentQuestionIndex = 0;
    studentAnswers = [];
    hasAnsweredCurrentQuestion = false; // Reset answered status
    
    // Create a copy of shuffled questions for this session
    // This ensures questions don't repeat within the same quiz session
    // Each student gets the same order, but questions never repeat
    sessionQuestions = [...shuffledQuestions];
    
    console.log(`Started quiz with ${sessionQuestions.length} questions for student: ${studentData.name}`);
    
    // Show first question
    showQuestion();
}

/**
 * Show current question
 */
function showQuestion() {
    const question = sessionQuestions[currentQuestionIndex];
    
    // Check if this question was already answered
    const existingAnswer = studentAnswers[currentQuestionIndex];
    hasAnsweredCurrentQuestion = existingAnswer ? true : false;
    
    // Update progress
    updateProgress();
    
    // Display question
    document.getElementById('questionText').textContent = question.question;
    
    // Hide answer required warning initially
    const warningElement = document.getElementById('answerRequiredWarning');
    warningElement.classList.add('hidden');
    
    // Create options
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    // Shuffle options for this question
    const options = [
        { letter: 'A', text: question.optionA },
        { letter: 'B', text: question.optionB },
        { letter: 'C', text: question.optionC },
        { letter: 'D', text: question.optionD }
    ];
    
    shuffledOptions = shuffleArray([...options]);
    
    shuffledOptions.forEach((option, index) => {
        const optionElement = createOptionElement(option, index);
        
        // If this question was already answered, mark the selected option
        if (hasAnsweredCurrentQuestion && existingAnswer && option.letter === existingAnswer.selectedOption) {
            optionElement.classList.add('selected');
        }
        
        optionsContainer.appendChild(optionElement);
    });
    
    // Update navigation buttons
    updateNavigationButtons();
}

/**
 * Create option element
 */
function createOptionElement(option, index) {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'option';
    optionDiv.dataset.option = option.letter;
    optionDiv.dataset.index = index;
    
    optionDiv.innerHTML = `
        <div class="option-letter">${option.letter}</div>
        <div class="option-text">${option.text}</div>
    `;
    
    optionDiv.addEventListener('click', () => selectOption(optionDiv, option.letter));
    
    // Prevent right-click on options (works on mobile too)
    optionDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
    
    // Prevent long press on mobile (shows context menu)
    optionDiv.addEventListener('touchstart', (e) => {
        let timer = setTimeout(() => {
            e.preventDefault();
            return false;
        }, 500);
        
        optionDiv.addEventListener('touchend', () => {
            clearTimeout(timer);
        }, { once: true });
    });
    
    return optionDiv;
}

/**
 * Select an option
 */
function selectOption(optionElement, selectedLetter) {
    // Remove previous selection
    const options = document.querySelectorAll('.option');
    options.forEach(opt => opt.classList.remove('selected'));
    
    // Mark selected option
    optionElement.classList.add('selected');
    
    // Store answer
    const question = sessionQuestions[currentQuestionIndex];
    const correctLetter = question.correct;
    
    // Ensure we have valid data
    if (!question || !question.question) {
        console.error('Invalid question data:', question);
        return;
    }
    

    studentAnswers[currentQuestionIndex] = {
        questionId: question.id || currentQuestionIndex,
        question: question.question || 'Unknown Question',
        selectedOption: selectedLetter || 'A',
        correctOption: correctLetter || 'A',
        isCorrect: selectedLetter === correctLetter
    };
    
    hasAnsweredCurrentQuestion = true; // Mark current question as answered
    
    // Hide answer required warning when answer is selected
    document.getElementById('answerRequiredWarning').classList.add('hidden');
}


/**
 * Update progress bar and counter
 */
function updateProgress() {
    const progress = ((currentQuestionIndex + 1) / sessionQuestions.length) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('questionCounter').textContent = 
        `السؤال ${currentQuestionIndex + 1} من ${sessionQuestions.length}`;
}

/**
 * Update navigation buttons
 */
function updateNavigationButtons() {
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');
    
    // Always show next/finish button
    if (currentQuestionIndex < sessionQuestions.length - 1) {
        nextBtn.classList.remove('hidden');
        finishBtn.classList.add('hidden');
    } else {
        nextBtn.classList.add('hidden');
        finishBtn.classList.remove('hidden');
    }
}

/**
 * Go to next question
 */
function nextQuestion() {
    // Check if current question is answered
    if (!hasAnsweredCurrentQuestion) {
        // Show warning message
        const warningElement = document.getElementById('answerRequiredWarning');
        warningElement.classList.remove('hidden');
        warningElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> يجب عليك اختيار إجابة واحدة قبل الانتقال للسؤال التالي';
        
        // Add shake animation to the warning
        warningElement.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            warningElement.style.animation = 'none';
        }, 500);
        
        return;
    }
    
    if (currentQuestionIndex < sessionQuestions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    }
}

/**
 * Finish the quiz
 */
async function finishQuiz() {
    // Check if current question is answered
    if (!hasAnsweredCurrentQuestion) {
        // Show warning message
        const warningElement = document.getElementById('answerRequiredWarning');
        warningElement.classList.remove('hidden');
        warningElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> يجب عليك اختيار إجابة واحدة قبل إنهاء الامتحان';
        
        // Add shake animation to the warning
        warningElement.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            warningElement.style.animation = 'none';
        }, 500);
        
        return;
    }
    
    try {
        showLoadingScreen();
        
        // Save results to Google Sheets via Apps Script
        console.log('Attempting to save results...');
        console.log('Apps Script URL:', APPS_SCRIPT_URL);
        console.log('Student data:', studentData);
        console.log('Answers count:', studentAnswers.length);
        
        // Filter out null/undefined answers
        const validAnswers = studentAnswers.filter(answer => 
            answer && 
            answer.question && 
            answer.selectedOption && 
            answer.correctOption !== undefined
        );
        
        console.log('Valid answers count:', validAnswers.length);
        console.log('All answers:', studentAnswers);
        console.log('Valid answers:', validAnswers);
        
        // Log sample answer to verify question text is included
        if (validAnswers.length > 0) {
            console.log('Sample answer structure:', {
                questionId: validAnswers[0].questionId,
                question: validAnswers[0].question,
                selectedOption: validAnswers[0].selectedOption,
                correctOption: validAnswers[0].correctOption,
                isCorrect: validAnswers[0].isCorrect
            });
        }
        
        if (validAnswers.length === 0) {
            throw new Error('لا توجد إجابات صحيحة لحفظها');
        }
        
        // Try multiple methods with retry mechanism
        const maxRetries = 3;
        let lastError;
        let response;
        let result;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Attempting to save results (attempt ${attempt}/${maxRetries})...`);
                
                // Create AbortController for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
                
                // Try POST first
                try {
                    console.log('Trying POST method...');
                    response = await mobileFetch(APPS_SCRIPT_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            action: 'saveResults',
                            studentData: studentData,
                            answers: validAnswers
                        }),
                        signal: controller.signal
                    });
                    console.log('POST response status:', response.status);
                } catch (postError) {
                    console.log('POST failed:', postError.message);
                    clearTimeout(timeoutId);
                    
                    // Try GET method as fallback
                    console.log('Trying GET method...');
                    const controller2 = new AbortController();
                    const timeoutId2 = setTimeout(() => controller2.abort(), 15000);
                    
                    const params = new URLSearchParams({
                        action: 'saveResults',
                        studentData: JSON.stringify(studentData),
                        answers: JSON.stringify(validAnswers),
                        t: Date.now() // Add timestamp to prevent caching
                    });
                    response = await mobileFetch(`${APPS_SCRIPT_URL}?${params}`, {
                        method: 'GET',
                        signal: controller2.signal
                    });
                    clearTimeout(timeoutId2);
                    console.log('GET response status:', response.status);
                }
                
                clearTimeout(timeoutId);
                
                console.log('Response status:', response.status);
                console.log('Response headers:', response.headers);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
                }
                
                const responseText = await response.text();
                console.log('Raw response:', responseText);
                
                try {
                    result = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('JSON parse error:', parseError);
                    console.error('Response text:', responseText);
                    throw new Error('Invalid JSON response from server');
                }
                
                console.log('Parsed result:', result);
                
                if (!result.success) {
                    console.error('Save results failed:', result.error);
                    throw new Error(result.error || 'فشل في حفظ النتائج');
                }
                
                console.log('Results saved successfully!');
                break; // Success, exit the retry loop
                
            } catch (error) {
                lastError = error;
                console.error(`Error saving results (attempt ${attempt}/${maxRetries}):`, error);
                
                if (attempt < maxRetries) {
                    console.log(`Retrying in ${attempt * 2} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                }
            }
        }
        
        // If all retries failed, throw the last error
        if (!result || !result.success) {
            throw lastError || new Error('فشل في حفظ النتائج بعد عدة محاولات');
        }
        
        showResults();
        
        // Update local exam history
        updateLocalExamHistory();
        
    } catch (error) {
        hideLoadingScreen();
        console.error('Save results error:', error);
        
        // Show results anyway if save fails
        if (error.message.includes('Failed to fetch')) {
            console.log('Connection failed, showing results locally...');
            // Show results without saving
            showResults();
            // Update local exam history even if save fails
            updateLocalExamHistory();
        } else {
            showError('حدث خطأ في حفظ النتائج: ' + error.message);
        }
    }
}

/**
 * Show results screen
 */
function showResults() {
    hideLoadingScreen();
    quizContainer.classList.add('hidden');
    resultsScreen.classList.remove('hidden');
    
    // Filter valid answers for display
    const validAnswers = studentAnswers.filter(answer => 
        answer && 
        answer.question && 
        answer.selectedOption && 
        answer.correctOption !== undefined
    );
    
    // Calculate results
    const correctCount = validAnswers.filter(answer => answer.isCorrect).length;
    const incorrectCount = validAnswers.length - correctCount;
    const percentage = validAnswers.length > 0 ? Math.round((correctCount / validAnswers.length) * 100) : 0;
    
    // Display results
    document.getElementById('finalScore').textContent = correctCount;
    document.getElementById('totalQuestions').textContent = validAnswers.length;
    document.getElementById('scorePercentage').textContent = percentage + '%';
    document.getElementById('correctCount').textContent = correctCount;
    document.getElementById('incorrectCount').textContent = incorrectCount;
    
    // Show review
    showReview();
}

/**
 * Show answer review
 */
function showReview() {
    const reviewContainer = document.getElementById('reviewContainer');
    reviewContainer.innerHTML = '';
    
    // Filter valid answers for review
    const validAnswers = studentAnswers.filter(answer => 
        answer && 
        answer.question && 
        answer.selectedOption && 
        answer.correctOption !== undefined
    );
    
    validAnswers.forEach((answer, index) => {
        const reviewItem = document.createElement('div');
        reviewItem.className = 'review-item';
        
        const statusClass = answer.isCorrect ? 'correct' : 'incorrect';
        const statusIcon = answer.isCorrect ? 'fas fa-check-circle' : 'fas fa-times-circle';
        
        reviewItem.innerHTML = `
            <div class="review-question">
                <i class="${statusIcon}"></i>
                السؤال ${index + 1}: ${answer.question}
            </div>
            <div class="review-answers">
                <div class="review-answer selected">
                    إجابتك: ${answer.selectedOption}
                </div>
                <div class="review-answer ${statusClass}">
                    الإجابة الصحيحة: ${answer.correctOption}
                </div>
            </div>
        `;
        
        reviewContainer.appendChild(reviewItem);
    });
}

/**
 * Show thank you page
 */
function showThankYouPage() {
    console.log('showThankYouPage called');
    
    // Hide quiz container
    const quizContainer = document.getElementById('quizContainer');
    if (quizContainer) {
        quizContainer.classList.add('hidden');
        console.log('Quiz container hidden');
    }
    
    // Hide results screen
    const resultsScreen = document.getElementById('resultsScreen');
    if (resultsScreen) {
        resultsScreen.classList.add('hidden');
        console.log('Results screen hidden');
    }
    
    // Show thank you modal
    const thankYouModal = document.getElementById('thankYouModal');
    if (thankYouModal) {
        thankYouModal.classList.remove('hidden');
        console.log('Thank you modal shown');
    } else {
        console.error('Thank you modal not found!');
    }
}

/**
 * Retake quiz
 */
function closeThankYouModal() {
    // Hide thank you modal
    const thankYouModal = document.getElementById('thankYouModal');
    if (thankYouModal) {
        thankYouModal.classList.add('hidden');
    }
    
    // Show registration form for new student
    showRegistrationForm();
}

/**
 * New student
 */
function newStudent() {
    // Hide all screens
    document.getElementById('quizContainer').classList.add('hidden');
    document.getElementById('resultsContainer').classList.add('hidden');
    document.getElementById('thankYouModal').classList.add('hidden');
    
    // Reset form
    document.getElementById('studentForm').reset();
    showRegistrationForm();
}

/**
 * Show loading screen
 */
function showLoadingScreen() {
    loadingScreen.classList.remove('hidden');
}

/**
 * Hide loading screen
 */
function hideLoadingScreen() {
    loadingScreen.classList.add('hidden');
}

/**
 * Show error modal
 */
function showError(message) {
    errorMessage.textContent = message;
    errorModal.classList.remove('hidden');
}

/**
 * Close error modal
 */
function closeErrorModal() {
    errorModal.classList.add('hidden');
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Setup security features to prevent cheating (Mobile Optimized)
 */
function setupSecurityFeatures() {
    // Check if device is mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Disable right-click context menu (works on mobile too)
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Prevent long press on text elements (mobile)
    document.addEventListener('touchstart', function(e) {
        if (e.target.tagName === 'H1' || e.target.tagName === 'H2' || e.target.tagName === 'H3' || 
            e.target.tagName === 'P' || e.target.tagName === 'SPAN' || e.target.tagName === 'DIV' ||
            e.target.tagName === 'IMG' || e.target.tagName === 'A' || e.target.tagName === 'BUTTON' ||
            e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' ||
            e.target.tagName === 'FORM' || e.target.tagName === 'LABEL' || e.target.tagName === 'I' ||
            e.target.tagName === 'SMALL' || e.target.tagName === 'STRONG' || e.target.tagName === 'EM' ||
            e.target.tagName === 'B' || e.target.tagName === 'U' || e.target.tagName === 'LI' ||
            e.target.tagName === 'OL' || e.target.tagName === 'UL' || e.target.tagName === 'TABLE' ||
            e.target.tagName === 'TR' || e.target.tagName === 'TD' || e.target.tagName === 'TH' ||
            e.target.tagName === 'SECTION' || e.target.tagName === 'ARTICLE' || e.target.tagName === 'ASIDE' ||
            e.target.tagName === 'HEADER' || e.target.tagName === 'FOOTER' || e.target.tagName === 'NAV' ||
            e.target.tagName === 'MAIN' || e.target.tagName === 'CANVAS' || e.target.tagName === 'SVG' ||
            e.target.tagName === 'PATH' || e.target.tagName === 'CIRCLE' || e.target.tagName === 'RECT') {
            let timer = setTimeout(() => {
                e.preventDefault();
                return false;
            }, 500);
            
            e.target.addEventListener('touchend', () => {
                clearTimeout(timer);
            }, { once: true });
        }
    });
    
    // Disable text selection (important for mobile)
    document.addEventListener('selectstart', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Disable copy events
    document.addEventListener('copy', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Disable cut events
    document.addEventListener('cut', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Disable paste events
    document.addEventListener('paste', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Disable drag and drop
    document.addEventListener('dragstart', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Prevent opening new windows/tabs
    window.addEventListener('beforeunload', function(e) {
        if (quizContainer && !quizContainer.classList.contains('hidden')) {
            e.preventDefault();
            e.returnValue = 'هل أنت متأكد من أنك تريد مغادرة الامتحان؟';
            return 'هل أنت متأكد من أنك تريد مغادرة الامتحان؟';
        }
    });
    
    // Disable window.open
    window.open = function() {
        return null;
    };
    
    // Mobile-specific security features
    if (isMobile) {
        // Prevent zooming during quiz
        document.addEventListener('gesturestart', function(e) {
            e.preventDefault();
        });
        
        document.addEventListener('gesturechange', function(e) {
            e.preventDefault();
        });
        
        document.addEventListener('gestureend', function(e) {
            e.preventDefault();
        });
        
        // Prevent double-tap zoom
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function(event) {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // Prevent pinch zoom
        document.addEventListener('touchmove', function(e) {
            if (e.scale !== 1) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    // Desktop-specific security features (only if not mobile)
    if (!isMobile) {
        // Disable keyboard shortcuts for copy, paste, cut, select all
        document.addEventListener('keydown', function(e) {
            // Prevent Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+Z, Ctrl+Y
            if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'a' || e.key === 'z' || e.key === 'y')) {
                e.preventDefault();
                return false;
            }
            
            // Prevent F12 (Developer Tools)
            if (e.key === 'F12') {
                e.preventDefault();
                return false;
            }
            
            // Prevent F5 and Ctrl+R (Refresh)
            if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
                e.preventDefault();
                return false;
            }
            
            // Prevent Ctrl+Shift+I (Developer Tools)
            if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                e.preventDefault();
                return false;
            }
            
            // Prevent Ctrl+U (View Source)
            if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
                return false;
            }
            
            // Prevent print
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                return false;
            }
            
            // Quiz-specific restrictions
            if (quizContainer && !quizContainer.classList.contains('hidden')) {
                // Prevent arrow keys during quiz
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    return false;
                }
                
                // Prevent Backspace (browser back)
                if (e.key === 'Backspace') {
                    e.preventDefault();
                    return false;
                }
                
                // Prevent Tab key during quiz
                if (e.key === 'Tab') {
                    e.preventDefault();
                    return false;
                }
                
                // Prevent Enter key during quiz
                if (e.key === 'Enter') {
                    e.preventDefault();
                    return false;
                }
                
                // Prevent Space key during quiz
                if (e.key === ' ') {
                    e.preventDefault();
                    return false;
                }
            }
        });
    }
    
    // Detect screen recording attempts (basic detection)
    let recordingDetectionCount = 0;
    setInterval(() => {
        if (document.hidden || document.webkitHidden) {
            recordingDetectionCount++;
            if (recordingDetectionCount > 5) {
                // Potential screen recording detected
                console.warn('Potential screen recording detected');
            }
        } else {
            recordingDetectionCount = 0;
        }
    }, 1000);
    
    // Add security class to body
    document.body.classList.add('security-mode');
}

// Make closeErrorModal globally available
window.closeErrorModal = closeErrorModal;


// Make utility functions globally available for developers
window.clearExamHistory = function() {
    localStorage.removeItem('examHistory');
    console.log('Exam history cleared');
    alert('تم مسح تاريخ الامتحانات المحلي');
};

window.showExamHistory = function() {
    const history = localStorage.getItem('examHistory');
    if (history) {
        console.log('Exam History:', JSON.parse(history));
        alert('تاريخ الامتحانات:\n' + JSON.stringify(JSON.parse(history), null, 2));
    } else {
        console.log('No exam history found');
        alert('لا يوجد تاريخ امتحانات محفوظ');
    }
};

// Test function for debugging
window.testConnection = async function() {
    console.log('Testing connection to:', APPS_SCRIPT_URL);
    console.log('Is Mobile:', isMobile);
    console.log('User Agent:', navigator.userAgent);
    
    try {
        // Test basic connection using mobile fetch
        const response = await mobileFetch(`${APPS_SCRIPT_URL}?action=test&t=${Date.now()}`, {
            method: 'GET'
        });
        
        console.log('Connection test response status:', response.status);
        console.log('Response headers:', response.headers);
        
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return { success: false, error: 'Invalid JSON response', rawResponse: responseText };
        }
        
        console.log('Connection test result:', result);
        return result;
    } catch (error) {
        console.error('Connection test error:', error);
        return { success: false, error: error.message };
    }
};

// Test function for loading questions
window.testLoadQuestions = async function() {
    console.log('Testing load questions...');
    console.log('Is Mobile:', isMobile);
    try {
        await loadQuestions();
        console.log('Load questions test successful!');
        console.log('Questions loaded:', questions.length);
        console.log('Questions:', questions);
        return { success: true, message: 'Questions loaded successfully', count: questions.length };
    } catch (error) {
        console.error('Load questions test failed:', error);
        return { success: false, error: error.message };
    }
};

// Test function specifically for mobile questions loading
window.testMobileQuestions = async function() {
    console.log('=== Testing Mobile Questions Loading ===');
    console.log('Is Mobile Device:', isMobile);
    console.log('User Agent:', navigator.userAgent);
    
    try {
        // Reset questions array
        questions = [];
        shuffledQuestions = [];
        
        console.log('Attempting to load questions...');
        await loadQuestions();
        
        console.log('Questions loaded successfully!');
        console.log('Number of questions:', questions.length);
        console.log('First question:', questions[0]);
        
        return {
            success: true,
            message: 'Questions loaded successfully',
            count: questions.length,
            isMobile: isMobile,
            questions: questions
        };
    } catch (error) {
        console.error('Mobile questions test failed:', error);
        return {
            success: false,
            error: error.message,
            isMobile: isMobile
        };
    }
};

// Test XMLHttpRequest specifically
window.testXHRQuestions = async function() {
    console.log('=== Testing XMLHttpRequest Questions Loading ===');
    console.log('Is Mobile Device:', isMobile);
    
    try {
        const data = await loadQuestionsXHR();
        console.log('XHR test result:', data);
        
        if (data.success && data.questions) {
            console.log('XHR questions loaded successfully!');
            console.log('Number of questions:', data.questions.length);
            return {
                success: true,
                message: 'XHR questions loaded successfully',
                count: data.questions.length,
                questions: data.questions
            };
        } else {
            throw new Error('XHR returned invalid data');
        }
    } catch (error) {
        console.error('XHR test failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

window.testSaveResults = async function() {
    const testData = {
        name: 'Test Student',
        email: 'test@example.com',
        age: 20,
        grade: 'الثانوية'
    };
    
    const testAnswers = [
        {
            questionId: 1,
            question: 'Test Question',
            selectedOption: 'A',
            correctOption: 'A',
            isCorrect: true
        }
    ];
    
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'saveResults',
                studentData: testData,
                answers: testAnswers
            })
        });
        
        const result = await response.json();
        console.log('Test save result:', result);
        return result;
    } catch (error) {
        console.error('Test save error:', error);
        return { success: false, error: error.message };
    }
};

// Comprehensive test function
window.runFullTest = async function() {
    console.log('=== Running Full Test ===');
    
    // Test 1: Basic connection
    console.log('1. Testing basic connection...');
    const connectionTest = await window.testConnection();
    console.log('Connection test result:', connectionTest);
    
    // Test 2: Load questions
    console.log('2. Testing load questions...');
    const loadTest = await window.testLoadQuestions();
    console.log('Load questions test result:', loadTest);
    
    // Test 3: Save results
    console.log('3. Testing save results...');
    const saveTest = await window.testSaveResults();
    console.log('Save results test result:', saveTest);
    
    // Summary
    const summary = {
        connection: connectionTest.success,
        loadQuestions: loadTest.success,
        saveResults: saveTest.success,
        allTestsPassed: connectionTest.success && loadTest.success && saveTest.success
    };
    
    console.log('=== Test Summary ===', summary);
    
    if (summary.allTestsPassed) {
        alert('جميع الاختبارات نجحت! التطبيق يعمل بشكل صحيح.');
    } else {
        alert('بعض الاختبارات فشلت. تحقق من Console للتفاصيل.');
    }
    
    return summary;
};

// Mobile-specific test function
window.testMobileCompatibility = async function() {
    console.log('=== Mobile Compatibility Test ===');
    console.log('Is Mobile Device:', isMobile);
    console.log('User Agent:', navigator.userAgent);
    console.log('Screen Size:', window.screen.width + 'x' + window.screen.height);
    console.log('Viewport Size:', window.innerWidth + 'x' + window.innerHeight);
    
    // Test network connectivity
    console.log('Testing network connectivity...');
    try {
        const response = await fetch('https://www.google.com/favicon.ico', {
            method: 'HEAD',
            mode: 'no-cors'
        });
        console.log('Network connectivity: OK');
    } catch (error) {
        console.error('Network connectivity: FAILED', error);
    }
    
    // Test Apps Script connection
    console.log('Testing Apps Script connection...');
    const connectionTest = await window.testConnection();
    console.log('Apps Script connection result:', connectionTest);
    
    // Test if fetch works with CORS
    console.log('Testing CORS compatibility...');
    try {
        const corsTest = await mobileFetch(APPS_SCRIPT_URL + '?action=test&t=' + Date.now(), {
            method: 'GET'
        });
        console.log('CORS test status:', corsTest.status);
        console.log('CORS test: OK');
    } catch (error) {
        console.error('CORS test: FAILED', error);
    }
    
    return {
        isMobile: isMobile,
        userAgent: navigator.userAgent,
        screenSize: window.screen.width + 'x' + window.screen.height,
        viewportSize: window.innerWidth + 'x' + window.innerHeight,
        connectionTest: connectionTest
    };
};
