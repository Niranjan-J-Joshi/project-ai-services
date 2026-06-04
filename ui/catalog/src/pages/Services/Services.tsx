import { useEffect, useState } from "react";
import { Tabs, TabList, Tab, TabPanels, TabPanel } from "@carbon/react";
import { PageHeader } from "@carbon/ibm-products";
import { ServiceCard, ServiceDetailPanel } from "@/components";
import type { ServiceDetailData } from "@/components";
import styles from "./Services.module.scss";
import {DeployedServicesTable} from "@/components";

const Services = () => {
  const [selectedService, setSelectedService] =
    useState<ServiceDetailData | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mockServices, setMockServices] = useState<ServiceDetailData[]>([]);
  const handleCardClick = (id: string) => {
    const service = mockServices.find((s) => s.id === id);
    if (service) {
      setSelectedService(service);
      setIsPanelOpen(true);
    }
  };

  useEffect(() => {
    fetch("/data/services.json")
      .then((res) => res.json())
      .then((data) => {
        setMockServices(data);
      });
  }, []);

  const handleDeploy = () => {};

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setTimeout(() => setSelectedService(null), 300);
  };

  return (
    <div className={styles.servicesContainer}>
      <PageHeader
        title="Services"
        subtitle="Single-purpose AI capabilities designed to perform specific tasks independently or as part of larger solutions."
        className={styles.pageHeader}
      />
      <Tabs>
        <TabList
          aria-label="Services tabs"
          contained={false}
          className={styles.tabList}
        >
          <Tab>Deployments</Tab>
          <Tab>Catalog</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <DeployedServicesTable />
          </TabPanel>
          <TabPanel>
            <div className={styles.catalogGrid}>
              {mockServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  id={service.id}
                  title={service.title}
                  description={service.description}
                  isCertified={service.isCertified}
                  onDeploy={handleDeploy}
                  onLearnMore={handleCardClick}
                />
              ))}
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <ServiceDetailPanel
        open={isPanelOpen}
        onClose={handleClosePanel}
        service={selectedService}
      />
    </div>
  );
};

export default Services;
