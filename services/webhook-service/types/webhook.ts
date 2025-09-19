export interface Device {
    Guid: string;
    Name: string;
    IsOnline: boolean;
    DeviceType: string;
    UniqueId: string;
    PhysicalName: string;
    State: string;
  }
  
  export interface Reader extends Device {
    ReaderType: string;
  }
  export interface AccessManager {
    Guid: string;
    Name: string;
    IsOnline: boolean;
    AccessManagerType: string;
    UniqueId: string;
    EventType: string;
    PhysicalName: string;
    State: string;
  }
  
export interface Module {
    Guid: string;
    Name: string;
    IsOnline: string;
    InterfaceType?: string;
    Readers?: Reader[];
    Inputs?: { IsOnline: string }[];
    outputs?: { IsOnline: string }[];
    childModules?: Module[];
}

export interface WebhookPayload {
    AccessManager?: string;
    EntityType: string;
    EventType: string;
    IsOnline?: string;
    InstallationId?: string;
    Guid: string;
    InterfaceModules?: Module[];
    ChildModules?: Module[];
}
  export interface EntityState {
    AccessManager: string;
  
    EntityType: string;
  
    EventType: string;
  
    IsOnline?: string;
  
    InterfaceModules?: Module[];
  
    ChildModules?: Module[];
  
  }
  // Federation-specific types
export interface FederatedPayload extends WebhookPayload {
  RemoteSystemVersion?: string;
  Group?: string;
  FederateAlarms?: boolean;
  Entity_ArchiverRole?: {
    RemoteSystemVersion?: string;
    Group?: string;
    FederateAlarms?: boolean;
  };
}