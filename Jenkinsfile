pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timeout(time: 20, unit: 'MINUTES')
    }

    environment {
        BASE_URL = 'http://belleza-staging-app-1:3002'
        HEADLESS = 'true'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'devops-sprint2',
                    url: 'https://github.com/AnEstuardoBarriosg/belleza-conceptual.git'
            }
        }

        stage('Build') {
            steps {
                sh '''
                    npm ci
                    python3 -m venv .venv
                    .venv/bin/python -m pip install -r requirements.txt

                    rm -f pytest-results*.xml report*.html
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                    .venv/bin/python -m pytest -v \
                        --junitxml=pytest-results.xml \
                        --html=report.html \
                        --self-contained-html
                '''
            }
        }

        stage('Deploy Staging') {
            steps {
                withCredentials([
                    string(
                        credentialsId: 'staging-db-password',
                        variable: 'STAGING_DB_PASSWORD'
                    )
                ]) {
                    sh '''
                        docker compose -f compose.staging.yaml \
                            up -d --build --wait --wait-timeout 180

                        docker compose -f compose.staging.yaml ps
                    '''
                }
            }
        }

        stage('Verify Staging') {
            steps {
                sh '''
                    .venv/bin/python -m pytest -v \
                        --junitxml=pytest-results-staging.xml \
                        --html=report-staging.html \
                        --self-contained-html
                '''
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true,
                  testResults: 'pytest-results*.xml'

            archiveArtifacts artifacts: 'report*.html',
                             allowEmptyArchive: true
        }
    }
}
