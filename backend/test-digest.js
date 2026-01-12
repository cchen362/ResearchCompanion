// Node.js 18+ has native fetch support

// Test data for Smart Digest generation
const testData = {
  findings: [
    {
      id: "finding-1",
      title: "Phase 3 Trial Shows 45% Reduction in Symptoms",
      summary: "A recent phase 3 clinical trial of Drug X demonstrated a 45% reduction in primary symptoms at 10mg daily dose over 12 weeks.",
      type: "clinical-trial",
      source: {
        name: "ClinicalTrials.gov",
        type: "clinical-trial",
      },
      isNew: true,
      timestamp: Date.now(),
      metadata: {
        trialId: "NCT12345678"
      }
    },
    {
      id: "finding-2",
      title: "New Biomarker Discovery for Early Detection",
      summary: "Researchers identified biomarker XYZ that can detect the condition 6 months earlier than current methods with 92% accuracy.",
      type: "research",
      source: {
        name: "Nature Medicine",
        type: "journal",
      },
      isNew: true,
      timestamp: Date.now(),
      metadata: {
        doi: "10.1038/s41591-024-12345"
      }
    },
    {
      id: "finding-3",
      title: "Side Effects Profile Updated for Common Treatment",
      summary: "Long-term safety study reveals 15% of patients experience mild GI issues, lower than previously reported 25%.",
      type: "safety",
      source: {
        name: "FDA Database",
        type: "regulatory",
      },
      isNew: false,
      timestamp: Date.now()
    }
  ],
  topic: {
    id: "topic-test",
    diseaseProfile: {
      name: "Test Condition"
    },
    patientContext: {
      currentStage: "monitoring"
    }
  },
  timeframe: "weekly"
};

async function testDigest() {
  try {
    console.log('Testing Smart Digest generation...');

    const response = await fetch('http://localhost:3001/api/generate-digest', {
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

    if (result.digest) {
      console.log('\n✅ Smart Digest generated successfully!');
      console.log('\n📊 Statistics:');
      console.log('- Total findings:', result.digest.statistics.totalFindings);
      console.log('- New findings:', result.digest.statistics.newFindings);
      console.log('- Source count:', result.digest.statistics.sourceCount);

      console.log('\n📝 Executive Summary:');
      console.log(result.digest.executiveSummary);

      console.log('\n🎯 Key Takeaways:');
      result.digest.keyTakeaways.forEach((takeaway, i) => {
        console.log(`${i + 1}. ${takeaway}`);
      });

      console.log('\n✨ Themes:');
      result.digest.themes.forEach(theme => {
        console.log(`- ${theme.title} (${theme.importance})`);
      });
    } else if (result.simplified) {
      console.log('\n⚠️ Fallback to simplified digest (Structured Outputs may have failed)');
      console.log('Simplified content:', result.simplified.substring(0, 200) + '...');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDigest();