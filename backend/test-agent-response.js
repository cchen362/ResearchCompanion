// Test what the agent endpoint is actually returning

const testAgentResponse = async () => {
  try {
    console.log('Testing agent response structure...\n');

    // Mock agent and topic to match frontend expectations
    const testData = {
      agent: {
        id: 'agent-test-123',
        name: 'Clinical Trial Scanner',
        type: 'clinical_trial',
        topicId: 'topic-test',
        config: {
          searchDepth: 'standard'
        }
      },
      topic: {
        id: 'topic-test',
        name: 'Test Topic',
        diseaseProfile: {
          name: 'Diabetes Type 2'
        },
        patientContext: {
          location: 'United States'
        }
      }
    };

    console.log('Sending request to /api/agent/run-agent...\n');

    const response = await fetch('http://localhost:3001/api/run-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error response:', error);
      return;
    }

    const result = await response.json();

    console.log('Response received. Analyzing structure...\n');
    console.log('Success:', result.success);
    console.log('Findings count:', result.findingsCount);
    console.log('Number of findings returned:', result.findings?.length || 0);

    if (result.findings && result.findings.length > 0) {
      console.log('\n=== FIRST FINDING STRUCTURE ===');
      const finding = result.findings[0];

      console.log('\nCore fields:');
      console.log('- id:', finding.id);
      console.log('- title:', finding.title);
      console.log('- type:', finding.type, '(should be "trial" not "clinical_trial")');
      console.log('- summary exists:', !!finding.summary);
      console.log('- details exists:', !!finding.details);
      console.log('- snippet exists:', !!finding.snippet);

      console.log('\nSource structure:');
      console.log('- source.type:', finding.source?.type);
      console.log('- source.name:', finding.source?.name);
      console.log('- source.displayName:', finding.source?.displayName);
      console.log('- source.url:', finding.source?.url);

      console.log('\nMetadata:');
      console.log('- metadata.nctId:', finding.metadata?.nctId);
      console.log('- metadata.status:', finding.metadata?.status);
      console.log('- metadata.studyType:', finding.metadata?.studyType);

      console.log('\n=== SOURCE ANALYSIS ===');
      if (!finding.source?.displayName) {
        console.log('❌ PROBLEM: Missing source.displayName!');
      } else if (finding.source.displayName === 'Unknown Source') {
        console.log('❌ PROBLEM: source.displayName is "Unknown Source"!');
      } else {
        console.log('✅ source.displayName is properly set:', finding.source.displayName);
      }

      if (finding.type !== 'trial') {
        console.log('❌ PROBLEM: type is not "trial"!');
      } else {
        console.log('✅ type is correctly set to "trial"');
      }

      console.log('\n=== FULL FINDING (first 500 chars) ===');
      console.log(JSON.stringify(finding, null, 2).substring(0, 500));

    } else {
      console.log('\n⚠️ No findings returned from the API');
      console.log('This might be because:');
      console.log('1. ENABLE_REAL_MEDICAL_SEARCH is not set to true');
      console.log('2. The search returned no results');
      console.log('3. There was an error in the search service');

      if (result.message) {
        console.log('\nAPI Message:', result.message);
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
};

testAgentResponse();