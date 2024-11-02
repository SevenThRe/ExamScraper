class Debugger {
  constructor(questions, aiAnswers) {
    this.questions = questions;
    this.aiAnswers = aiAnswers;
    this.results = [];
  }

  compareAnswers() {
    this.questions.forEach((question, index) => {
      const correctAnswer = question.answer; // 页面上的正确答案
      const aiAnswer = this.aiAnswers[index]; // AI 的答案

      const isCorrect = correctAnswer === aiAnswer;
      this.results.push({
        questionNumber: question.number,
        correctAnswer: correctAnswer,
        aiAnswer: aiAnswer,
        isCorrect: isCorrect
      });
    });
  }

  generateCSV() {
    const csvRows = [];
    csvRows.push(['题号', '正确答案', 'AI 答案', '是否正确']);

    this.results.forEach(result => {
      csvRows.push([
        result.questionNumber,
        result.correctAnswer,
        result.aiAnswer,
        result.isCorrect ? '是' : '否'
      ]);
    });

    const csvString = csvRows.map(row => row.join(',')).join('\n');
    return csvString;
  }

  downloadCSV() {
    const csv = this.generateCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'ai_answers_comparison.csv');
    a.click();
  }
} 