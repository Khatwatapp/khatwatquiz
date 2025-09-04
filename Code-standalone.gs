/**
 * Google Apps Script for Quiz App - Standalone Version
 * This script handles the backend logic for the quiz application
 * Modified to work with standalone HTML/JS files
 */

// Configuration
const CONFIG = {
  QUESTIONS_SHEET_NAME: 'Questions',
  RESULTS_SHEET_NAME: 'Results',
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE' // Replace with your actual spreadsheet ID
};

/**
 * Handle GET requests - serves JSON responses for API calls
 */
function doGet(e) {
  // Handle case where e might be undefined
  const action = e && e.parameter ? e.parameter.action : null;
  
  try {
    switch (action) {
      case 'getQuestions':
        return ContentService
          .createTextOutput(JSON.stringify(getQuestions()))
          .setMimeType(ContentService.MimeType.JSON);
      
      case 'getStats':
        return ContentService
          .createTextOutput(JSON.stringify(getQuizStats()))
          .setMimeType(ContentService.MimeType.JSON);
      
      case 'saveResults':
        // Handle save results via GET (fallback method)
        try {
          const studentData = e.parameter.studentData ? JSON.parse(e.parameter.studentData) : null;
          const answers = e.parameter.answers ? JSON.parse(e.parameter.answers) : null;
          
          if (!studentData || !answers) {
            throw new Error('Missing student data or answers');
          }
          
          return ContentService
            .createTextOutput(JSON.stringify(saveResults(studentData, answers)))
            .setMimeType(ContentService.MimeType.JSON);
        } catch (error) {
          return ContentService
            .createTextOutput(JSON.stringify({
              success: false,
              error: error.message
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      
      default:
        // If no action specified, return questions by default
        return ContentService
          .createTextOutput(JSON.stringify(getQuestions()))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests - for saving results
 */
function doPost(e) {
  try {
    // Handle case where e might be undefined
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'No data received'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch (action) {
      case 'saveResults':
        return ContentService
          .createTextOutput(JSON.stringify(saveResults(data.studentData, data.answers)))
          .setMimeType(ContentService.MimeType.JSON);
      
      default:
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            error: 'Invalid action'
          }))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get all questions from the Questions sheet
 */
function getQuestions() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.QUESTIONS_SHEET_NAME);
    
    if (!sheet) {
      throw new Error('Questions sheet not found');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const questions = [];
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) { // Check if question exists
        questions.push({
          id: i,
          question: row[0],
          optionA: row[1] || '',
          optionB: row[2] || '',
          optionC: row[3] || '',
          optionD: row[4] || '',
          correct: row[5] || 'A'
        });
      }
    }
    
    return {
      success: true,
      questions: questions
    };
  } catch (error) {
    console.error('Error getting questions:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Save quiz results to the Results sheet
 */
function saveResults(studentData, answers) {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = spreadsheet.getSheetByName(CONFIG.RESULTS_SHEET_NAME);
    
    // Create Results sheet if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet(CONFIG.RESULTS_SHEET_NAME);
      // Add headers
      sheet.getRange(1, 1, 1, 9).setValues([[
        'Timestamp', 'Name', 'Email', 'Age', 'Grade', 
        'Question', 'SelectedOption', 'CorrectOption', 'IsCorrect'
      ]]);
      sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    }
    
    const timestamp = new Date();
    const results = [];
    
    // Process each answer
    answers.forEach(answer => {
      results.push([
        timestamp,
        studentData.name,
        studentData.email,
        studentData.age || '',
        studentData.grade,
        answer.question,
        answer.selectedOption,
        answer.correctOption,
        answer.isCorrect
      ]);
    });
    
    // Add results to sheet
    if (results.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, results.length, 9).setValues(results);
    }
    
    return {
      success: true,
      message: 'Results saved successfully'
    };
  } catch (error) {
    console.error('Error saving results:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get quiz statistics (optional feature)
 */
function getQuizStats() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.RESULTS_SHEET_NAME);
    
    if (!sheet) {
      return {
        success: true,
        stats: {
          totalAttempts: 0,
          averageScore: 0
        }
      };
    }
    
    const data = sheet.getDataRange().getValues();
    const attempts = new Set();
    let totalCorrect = 0;
    let totalAnswers = 0;
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const timestamp = row[0];
      const isCorrect = row[8];
      
      attempts.add(timestamp.getTime());
      totalAnswers++;
      if (isCorrect === true) {
        totalCorrect++;
      }
    }
    
    const averageScore = totalAnswers > 0 ? (totalCorrect / totalAnswers) * 100 : 0;
    
    return {
      success: true,
      stats: {
        totalAttempts: attempts.size,
        averageScore: Math.round(averageScore * 100) / 100
      }
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test function to verify setup
 */
function testSetup() {
  try {
    const questionsResult = getQuestions();
    console.log('Questions test:', questionsResult);
    
    const statsResult = getQuizStats();
    console.log('Stats test:', statsResult);
    
    return {
      success: true,
      message: 'Setup test completed successfully'
    };
  } catch (error) {
    console.error('Setup test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Simple test function for debugging
 */
function test() {
  return {
    success: true,
    message: 'Apps Script is working!',
    timestamp: new Date().toISOString()
  };
}
