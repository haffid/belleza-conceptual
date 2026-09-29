pipeline {
    agent any

    environment {
        BASE_URL = 'https://belleza-conceptual.onrender.com'
        HEADLESS = 'true'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build') {
            steps {
                bat '''
                    node --version
                    npm --version

                    if exist package-lock.json (
                        npm ci
                    ) else (
                        npm install
                    )
                '''
            }
        }

        stage('Test') {
            steps {
                bat '''
                    python --version
                    python -m venv .venv
                    .venv\\Scripts\\python.exe -m pip install --upgrade pip
                    .venv\\Scripts\\python.exe -m pip install -r requirements.txt
                    .venv\\Scripts\\python.exe -m pytest -v --junitxml=pytest-results.xml --html=report.html --self-contained-html
                '''
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'pytest-results.xml'

            archiveArtifacts artifacts: 'report.html',
                             allowEmptyArchive: true
        }
    }
}