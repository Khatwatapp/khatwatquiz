/**
 * Quiz App JavaScript - Standalone Version
 * Handles all frontend functionality for the quiz application
 * Uses Apps Script URL for backend communication
 */

// Configuration - Replace with your Apps Script URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzZC74BK7c9QynUTwkk40GK6SBftvmeQVYqGEgYQds2O-LwSUOqzapdx041b-lUJHetwg/exec';

// Global variables
let questions = [];
let currentQuestionIndex = 0;
let studentAnswers = [];
let studentData = {};
let shuffledQuestions = [];
let sessionQuestions = []; // Questions for current session (no repetition)
let shuffledOptions = [];
let hasAnsweredCurrentQuestion = false; // Track if current question is answered

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
 * Load questions from Google Sheets via Apps Script
 */
async function loadQuestions() {
    try {
        // Try with action parameter first
        let response = await fetch(`${APPS_SCRIPT_URL}?action=getQuestions`);
        
        // If that fails, try without action parameter
        if (!response.ok) {
            response = await fetch(APPS_SCRIPT_URL);
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'فشل في تحميل الأسئلة');
        }
        
        questions = data.questions;
        
        if (questions.length === 0) {
            throw new Error('لا توجد أسئلة متاحة');
        }
        
        // Shuffle questions once - they will be used for the entire session
        // Each student gets the same shuffled order, but questions never repeat
        shuffledQuestions = shuffleArray([...questions]);
        
        console.log(`Loaded ${questions.length} questions, shuffled for session`);
        
    } catch (error) {
        console.error('Error loading questions:', error);
        throw error;
    }
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
            warningElement.style.animation = '';
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
            warningElement.style.animation = '';
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
        
        // Try POST first, then fallback to GET if needed
        let response;
        try {
            console.log('Trying POST method...');
            response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'saveResults',
                    studentData: studentData,
                    answers: validAnswers
                })
            });
            console.log('POST response status:', response.status);
        } catch (postError) {
            console.log('POST failed:', postError.message);
            console.log('Trying GET method...');
            // Fallback to GET method with URL parameters
            const params = new URLSearchParams({
                action: 'saveResults',
                studentData: JSON.stringify(studentData),
                answers: JSON.stringify(validAnswers)
            });
            response = await fetch(`${APPS_SCRIPT_URL}?${params}`);
            console.log('GET response status:', response.status);
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'فشل في حفظ النتائج');
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
    
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        console.log('Connection test response status:', response.status);
        
        const result = await response.json();
        console.log('Connection test result:', result);
        return result;
    } catch (error) {
        console.error('Connection test error:', error);
        return { success: false, error: error.message };
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
